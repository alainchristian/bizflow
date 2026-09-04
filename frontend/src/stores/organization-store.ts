import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface OrganizationState {
  currentOrganizationId: string | null
  setCurrentOrganizationId: (id: string) => void
  clearCurrentOrganizationId: () => void
}

export const useOrganizationStore = create<OrganizationState>()(
  persist(
    (set) => ({
      currentOrganizationId: null,
      setCurrentOrganizationId: (id) => set({ currentOrganizationId: id }),
      clearCurrentOrganizationId: () => set({ currentOrganizationId: null }),
    }),
    { name: 'bizflow-organization' },
  ),
)
