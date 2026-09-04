import { Route, Routes } from 'react-router-dom'
import { RequireAuth } from './components/RequireAuth.tsx'
import { AppLayout } from './layout/AppLayout.tsx'
import { AccountPage } from './pages/AccountPage.tsx'
import { LoginPage } from './pages/auth/LoginPage.tsx'
import { RegisterPage } from './pages/auth/RegisterPage.tsx'
import { HomePage } from './pages/HomePage.tsx'
import { NotFoundPage } from './pages/NotFoundPage.tsx'
import { CreateOrganizationPage } from './pages/organizations/CreateOrganizationPage.tsx'

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route element={<RequireAuth />}>
          <Route path="account" element={<AccountPage />} />
          <Route path="organizations/new" element={<CreateOrganizationPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
