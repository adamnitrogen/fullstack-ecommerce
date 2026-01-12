import { logger } from "@/lib/logger";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import axios from "axios";
import { fallbackCountries, fallbackStates } from "../data/fallbackLocation";
import { PostalCodeResult } from "@/types";

interface Country {
    country: string;
    iso2: string;
    phone_code?: string;
}

interface State {
    name: string;
    state_code: string;
}

interface CSCCountry {
    name: string;
    iso2: string;
    phonecode: string;
}

interface CSCState {
    name: string;
    iso2: string;
    country_code: string;
}

interface LocationState {
    countries: Country[];
    states: Record<string, State[]>; // Cache states by country ISO2
    postalCodeCache: Record<string, PostalCodeResult | false>; // Cache validation results "postalCode" -> data or false
    isLoadingCountries: boolean;
    isLoadingStates: Record<string, boolean>; // Loading state per country
    isValidatingPostalCode: boolean;
    error: string | null;
    isInitialized: boolean;

    initializeStore: () => Promise<void>;
    fetchCountries: () => Promise<void>;
    fetchStates: (countryIso2: string) => Promise<void>;
    validatePostalCode: (postalCode: string) => Promise<PostalCodeResult | false>;
}

export const useLocationStore = create<LocationState>()(
    persist(
        (set, get) => ({
            countries: [],
            states: {},
            postalCodeCache: {},
            isLoadingCountries: false,
            isLoadingStates: {},
            isValidatingPostalCode: false,
            error: null,
            isInitialized: false,

            initializeStore: async () => {
                if (get().isInitialized && get().countries.length > 0) {
                    logger.debug("Loaded from cache");
                    return;
                }

                logger.debug("Location Store: Starting initialization...");
                set({ isLoadingCountries: true, error: null });
                try {
                    const apiKey = import.meta.env.VITE_CSC_API_KEY;
                    let formattedCountries: Country[] = [];

                    // 1. Fetch clean dialing codes from RestCountries (User requirement: use root only)
                    logger.debug("Location Store: Fetching dialing codes from RestCountries...");
                    const countriesApi = import.meta.env.VITE_REST_COUNTRIES_API_URL || "https://restcountries.com/v3.1/all?fields=cca2,idd";
                    /*
                        RestCountries gives us "idd": { "root": "+1", "suffixes": [...] }
                        We only want the root for the phone code to avoid suffixes (e.g., +1 for US/Canada, not +1204)
                    */
                    const dialingCodeMap: Record<string, string> = {};
                    try {
                        const rcResponse = await axios.get(countriesApi);
                        if (rcResponse.data && Array.isArray(rcResponse.data)) {
                            rcResponse.data.forEach((c: { idd?: { root?: string; suffixes?: string[] }; cca2: string }) => {
                                if (c.idd?.root) {
                                    const root = c.idd.root;
                                    const suffixes = c.idd.suffixes || [];

                                    // Logic per user request:
                                    // If 1 suffix -> Add it to root (e.g. India +9 + 1 = +91)
                                    // If multiple -> Use root only (e.g. US +1)
                                    if (suffixes.length === 1) {
                                        dialingCodeMap[c.cca2] = root + suffixes[0];
                                    } else {
                                        dialingCodeMap[c.cca2] = root;
                                    }
                                }
                            });
                        }
                    } catch (rcError) {
                        logger.warn("Location Store: Failed to fetch dialing codes from RestCountries", rcError);
                    }


                    // 2. Fetch Countries from CountryStateCity API (User requirement: source for countries/states)
                    if (apiKey) {
                        logger.debug("Location Store: Fetching countries from CSC API...");
                        const cscResponse = await axios.get(`${import.meta.env.VITE_CSC_API_URL}/countries`, {
                            headers: { 'X-CSCAPI-KEY': apiKey }
                        });

                        // ... inside the store actions

                        if (cscResponse.data && Array.isArray(cscResponse.data)) {
                            // Merge: Use CSC Name/ISO, but RestCountries Phone Code
                            formattedCountries = (cscResponse.data as CSCCountry[]).map((c) => {
                                const cleanPhoneCode = dialingCodeMap[c.iso2] || (c.phonecode ? `+${c.phonecode}` : '');
                                return {
                                    country: c.name,
                                    iso2: c.iso2,
                                    phone_code: cleanPhoneCode
                                };
                            }).sort((a, b) => a.country.localeCompare(b.country));

                            logger.debug(`Location Store: Merged ${formattedCountries.length} countries (CSC + RC Codes).`);
                        }
                    }

                    // Fallback to purely RestCountries if CSC failed or no key
                    if (formattedCountries.length === 0) {
                        logger.debug("Location Store: Fallback to RestCountries for full data...");
                        // RestCountries response type
                        const fullRcResponse = await axios.get("https://restcountries.com/v3.1/all?fields=name,cca2,idd");
                        interface RestCountry {
                            name: { common: string };
                            cca2: string;
                            idd?: { root: string; suffixes?: string[] };
                        }
                        if (fullRcResponse.data && Array.isArray(fullRcResponse.data)) {
                            formattedCountries = (fullRcResponse.data as RestCountry[]).map((c) => {
                                return {
                                    country: c.name.common,
                                    iso2: c.cca2,
                                    phone_code: c.idd?.root || "" // User explicitly wants ONLY root
                                };
                            }).sort((a, b) => a.country.localeCompare(b.country));
                        }
                    }

                    if (formattedCountries.length > 0) {
                        // Try to fetch states if API key is available
                        let statesMap: Record<string, State[]> = {};
                        if (apiKey) {
                            // ... existing state fetch logic ...
                            logger.debug("Location Store: API Key found for States. Fetching...");
                            try {
                                const statesResponse = await axios.get(`${import.meta.env.VITE_CSC_API_URL}/states`, {
                                    headers: { 'X-CSCAPI-KEY': apiKey }
                                });
                                if (statesResponse.data && Array.isArray(statesResponse.data)) {
                                    (statesResponse.data as CSCState[]).forEach((s) => {
                                        const countryCode = s.country_code;
                                        if (!statesMap[countryCode]) {
                                            statesMap[countryCode] = [];
                                        }
                                        statesMap[countryCode].push({
                                            name: s.name,
                                            state_code: s.iso2
                                        });
                                    });
                                }
                            } catch (stateErr) {
                                logger.warn("Location Store: Failed to fetch states from API, using fallback map if available", stateErr);
                                statesMap = fallbackStates;
                            }
                        } else {
                            statesMap = fallbackStates;
                        }

                        set({
                            countries: formattedCountries,
                            states: statesMap,
                            isInitialized: true
                        });
                        logger.debug("Location Store: Initialization complete.");
                    } else {
                        throw new Error("Empty response from APIs");
                    }


                } catch (err) {
                    logger.error('Location Store: Init failed, using fallback.', err);
                    set({
                        error: 'Failed to load live data, using fallback',
                        countries: fallbackCountries,
                        states: fallbackStates,
                        isInitialized: true
                    });
                } finally {
                    set({ isLoadingCountries: false });
                }
            },

            fetchCountries: async () => {
                // No-op if initialized, already handled by initializeStore
                if (get().isInitialized) return;
                await get().initializeStore();
            },

            fetchStates: async (countryIso2: string) => {
                // No-op if initialized, data should be there
                // Use fallback logic internally if missing? 
                // If valid country but no states found in bulk fetch, maybe fetch specifically? 
                // For now, assume bulk fetch worked.
                if (get().isInitialized) return;

                // If not initialized (rare race condition if called before init finishes), allow individual fetch or wait
                // But usually we just wait for cache.
            },

            validatePostalCode: async (postalCode: string) => {
                if (!postalCode) return false;

                const cacheKey = postalCode;
                const cachedResult = get().postalCodeCache[cacheKey];
                if (cachedResult !== undefined) return cachedResult;

                set({ isValidatingPostalCode: true });

                try {
                    const postalApi = import.meta.env.VITE_POSTAL_PINCODE_API_URL || "https://api.postalpincode.in/pincode";
                    const response = await axios.get(`${postalApi}/${postalCode}`);

                    if (response.data && response.data[0].Status === 'Success' && response.data[0].PostOffice.length > 0) {
                        const postOffice = response.data[0].PostOffice[0];
                        const result = {
                            isValid: true,
                            city: postOffice.District,
                            state: postOffice.State,
                            country: postOffice.Country,
                            locality: postOffice.Name
                        };

                        set((state) => ({
                            postalCodeCache: { ...state.postalCodeCache, [cacheKey]: result }
                        }));
                        return result;
                    } else {
                        set((state) => ({
                            postalCodeCache: { ...state.postalCodeCache, [cacheKey]: false }
                        }));
                        return false;
                    }

                } catch (error) {
                    logger.error("Postal validation failed", error);
                    return false;
                } finally {
                    set({ isValidatingPostalCode: false });
                }
            }
        }),
        {
            name: 'location-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                countries: state.countries,
                states: state.states,
                isInitialized: state.isInitialized,
                postalCodeCache: state.postalCodeCache
            })
        }
    )
);
