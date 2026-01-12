// Centralized validation utility for consistent form validation across the application

export interface ValidationError {
  [key: string]: string | undefined;
}

// Validation functions
export const validators = {
  required: (value: unknown, fieldName: string = "This field"): string | null => {
    if (
      value === null ||
      value === undefined ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)
    ) {
      return `${fieldName} is required`;
    }
    if (typeof value === "string" && value.trim() === "") {
      return `${fieldName} is required`;
    }
    return null;
  },

  email: (value: string): string | null => {
    if (!value) return null;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return "Please enter a valid email address";
    }
    return null;
  },

  phone: (value: string): string | null => {
    if (!value) return null;
    // Remove all non-digit characters
    const digitsOnly = value.replace(/\D/g, "");

    // Check for Indian phone number (10 digits) with optional country code
    if (digitsOnly.length === 10) {
      return null; // Valid Indian phone number
    } else if (digitsOnly.length === 12 && digitsOnly.startsWith("91")) {
      return null; // Valid with +91 country code
    } else if (digitsOnly.length === 13 && digitsOnly.startsWith("091")) {
      return null; // Valid with 091 country code
    }

    return "Please enter a valid 10-digit phone number";
  },

  phoneWithCountryCode: (value: string): string | null => {
    if (!value) return null;
    const digitsOnly = value.replace(/\D/g, "");

    if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
      return null;
    }

    return "Please enter a valid phone number with country code (e.g., +91 9876543210)";
  },

  minLength: (
    value: string,
    min: number,
    fieldName: string = "This field"
  ): string | null => {
    if (!value) return null;
    if (value.length < min) {
      return `${fieldName} must be at least ${min} characters`;
    }
    return null;
  },

  maxLength: (
    value: string,
    max: number,
    fieldName: string = "This field"
  ): string | null => {
    if (!value) return null;
    if (value.length > max) {
      return `${fieldName} must not exceed ${max} characters`;
    }
    return null;
  },

  minValue: (
    value: number,
    min: number,
    fieldName: string = "This field"
  ): string | null => {
    if (value === null || value === undefined) return null;
    if (value < min) {
      return `${fieldName} must be at least ${min}`;
    }
    return null;
  },

  maxValue: (
    value: number,
    max: number,
    fieldName: string = "This field"
  ): string | null => {
    if (value === null || value === undefined) return null;
    if (value > max) {
      return `${fieldName} must not exceed ${max}`;
    }
    return null;
  },

  url: (value: string): string | null => {
    if (!value) return null;
    try {
      new URL(value);
      return null;
    } catch {
      return "Please enter a valid URL (e.g., https://example.com)";
    }
  },

  pincode: (value: string): string | null => {
    if (!value) return null;
    const pincodeRegex = /^\d{6}$/;
    if (!pincodeRegex.test(value)) {
      return "Please enter a valid 6-digit pincode";
    }
    return null;
  },

  password: (value: string): string | null => {
    if (!value) return null;
    if (value.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (!/[A-Z]/.test(value)) {
      return "Password must contain at least one uppercase letter";
    }
    if (!/[a-z]/.test(value)) {
      return "Password must contain at least one lowercase letter";
    }
    if (!/[0-9]/.test(value)) {
      return "Password must contain at least one number";
    }
    if (!/[^a-zA-Z0-9]/.test(value)) {
      return "Password must contain at least one special character";
    }
    return null;
  },

  confirmPassword: (value: string, originalPassword: string): string | null => {
    if (!value) return null;
    if (value !== originalPassword) {
      return "Passwords do not match";
    }
    return null;
  },

  alphanumeric: (
    value: string,
    fieldName: string = "This field"
  ): string | null => {
    if (!value) return null;
    const alphanumericRegex = /^[a-zA-Z0-9\s]+$/;
    if (!alphanumericRegex.test(value)) {
      return `${fieldName} should only contain letters and numbers`;
    }
    return null;
  },

  numeric: (value: string, fieldName: string = "This field"): string | null => {
    if (!value) return null;
    const numericRegex = /^\d+$/;
    if (!numericRegex.test(value)) {
      return `${fieldName} should only contain numbers`;
    }
    return null;
  },

  date: (value: string): string | null => {
    if (!value) return null;
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return "Please enter a valid date";
    }
    return null;
  },

  futureDate: (value: string): string | null => {
    if (!value) return null;
    const date = new Date(value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (date < today) {
      return "Date must be in the future";
    }
    return null;
  },

  pastDate: (value: string): string | null => {
    if (!value) return null;
    const date = new Date(value);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (date > today) {
      return "Date must be in the past";
    }
    return null;
  },
};

// Validation helper to validate an entire form
export const validateForm = (
  formData: Record<string, unknown>,
  validationRules: Record<string, Array<(value: unknown) => string | null>>
): ValidationError => {
  const errors: ValidationError = {};

  Object.keys(validationRules).forEach((fieldName) => {
    const rules = validationRules[fieldName];
    const value = formData[fieldName];

    for (const rule of rules) {
      const error = rule(value);
      if (error) {
        errors[fieldName] = error;
        break; // Stop at first error for this field
      }
    }
  });

  return errors;
};

// Indian States for dropdowns
export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

// Countries for dropdowns
export const COUNTRIES = [
  "India",
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "Japan",
  "China",
  "Singapore",
  "United Arab Emirates",
  "Saudi Arabia",
  "Nepal",
  "Bangladesh",
  "Sri Lanka",
  "Pakistan",
  "Afghanistan",
  "Bhutan",
  "Maldives",
  // Add more countries as needed
];
