import { z } from 'zod'

export const createOrganizationSchema = z.object({
  name: z.string().min(1, 'Organization name is required'),
  countryCode: z.string().length(2, 'Select a country'),
  baseCurrency: z.string().length(3, 'Select a currency'),
})

export type CreateOrganizationValues = z.infer<typeof createOrganizationSchema>

// A small curated list is enough for MVP -- this is not meant to be an
// exhaustive ISO 3166-1 list, just enough to unblock onboarding without
// free-text country/currency codes the backend would reject.
export const COUNTRY_OPTIONS = [
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'CA', label: 'Canada' },
  { code: 'AU', label: 'Australia' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'ES', label: 'Spain' },
  { code: 'IT', label: 'Italy' },
  { code: 'NL', label: 'Netherlands' },
  { code: 'IE', label: 'Ireland' },
  { code: 'IN', label: 'India' },
  { code: 'SG', label: 'Singapore' },
  { code: 'AE', label: 'United Arab Emirates' },
  { code: 'ZA', label: 'South Africa' },
  { code: 'KE', label: 'Kenya' },
  { code: 'NG', label: 'Nigeria' },
]

export const CURRENCY_OPTIONS = [
  { code: 'USD', label: 'USD - US Dollar' },
  { code: 'GBP', label: 'GBP - British Pound' },
  { code: 'CAD', label: 'CAD - Canadian Dollar' },
  { code: 'AUD', label: 'AUD - Australian Dollar' },
  { code: 'EUR', label: 'EUR - Euro' },
  { code: 'INR', label: 'INR - Indian Rupee' },
  { code: 'SGD', label: 'SGD - Singapore Dollar' },
  { code: 'AED', label: 'AED - UAE Dirham' },
  { code: 'ZAR', label: 'ZAR - South African Rand' },
  { code: 'KES', label: 'KES - Kenyan Shilling' },
  { code: 'NGN', label: 'NGN - Nigerian Naira' },
]
