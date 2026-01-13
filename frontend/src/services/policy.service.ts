import { apiClient } from '@/lib/api-client';

export type PolicyType = 'privacy' | 'terms' | 'shipping-refund';

export interface Policy {
    id?: string;
    policy_type: PolicyType;
    title: string;
    contentHtml: string;
    version: number;
    updatedAt?: string;
}

export const policyService = {
    upload: async (file: File, policyType: PolicyType, title?: string): Promise<Policy> => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('policyType', policyType);
        if (title) formData.append('title', title);

        const response = await apiClient.post('/policies/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data.policy;
    },

    getPublic: async (policyType: PolicyType): Promise<Policy> => {
        try {
            // 1. Get current version
            const { version } = await policyService.getVersion(policyType);

            // 2. Check local cache
            const cacheKey = `policy_${policyType}`;
            const cachedData = localStorage.getItem(cacheKey);

            if (cachedData) {
                const parsed = JSON.parse(cachedData) as Policy;
                if (parsed.version === version) {
                    console.log(`Serving ${policyType} policy from cache (v${version})`);
                    return parsed;
                }
            }

            // 3. Fetch from API if cache miss or version mismatch
            const response = await apiClient.get(`/policies/public/${policyType}`);
            const data = response.data;

            // 4. Update cache
            localStorage.setItem(cacheKey, JSON.stringify(data));

            return data;
        } catch (error) {
            console.error('Error fetching policy:', error);
            // Fallback to direct fetch if version check fails
            const response = await apiClient.get(`/policies/public/${policyType}`);
            return response.data;
        }
    },

    getVersion: async (policyType: PolicyType): Promise<{ version: number }> => {
        const response = await apiClient.get(`/policies/public/${policyType}/version`);
        return response.data;
    }
};
