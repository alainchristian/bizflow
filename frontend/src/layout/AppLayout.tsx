import { Outlet } from 'react-router-dom'

export function AppLayout() {
  return (
    <div className="min-h-svh bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <span className="text-lg font-semibold text-gray-900">BizFlow</span>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  )
}
