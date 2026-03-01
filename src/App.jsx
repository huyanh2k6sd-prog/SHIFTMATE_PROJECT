import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './components/AuthContext'
import { Auth } from './pages/Auth'
import { Layout } from './components/Layout'

import { WorkspaceSelection } from './pages/WorkspaceSelection'
import LandingPage from './pages/LandingPage'
import { ManagerDashboard } from './pages/ManagerDashboard'
import { ManagerPayroll } from './pages/ManagerPayroll'
import { ManagerSettings } from './pages/ManagerSettings'
import { EmployeeDashboard } from './pages/EmployeeDashboard'
import { EmployeeAvailability } from './pages/EmployeeAvailability'
import { EmployeeEarnings } from './pages/EmployeeEarnings'
import { EmployeeRoleSelection } from './pages/EmployeeRoleSelection'
import { ProfileDemo } from './pages/ProfileDemo'
import { ManagerRoleManagement } from './pages/ManagerRoleManagement'
import { ResetPassword } from './pages/ResetPassword'

function ProtectedRoute({ children }) {
    const { user } = useAuth()
    if (!user) {
        return <Navigate to="/auth" replace />
    }
    return children
}

// Redirect logged-in users away from /auth
function AuthRoute({ children }) {
    const { user } = useAuth()
    const isSigningUp = sessionStorage.getItem('shiftmate_signing_up') === 'true'

    // Only redirect if a user exists AND we aren't in the middle of a sign-up process
    if (user && !isSigningUp) {
        return <Navigate to="/workspace" replace />
    }
    return children
}


function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route
                        path="/"
                        element={<LandingPage />}
                    />
                    <Route
                        path="/workspace"
                        element={
                            <ProtectedRoute>
                                <WorkspaceSelection />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/manager/dashboard/:workspaceId/:roleId?"
                        element={
                            <ProtectedRoute>
                                <ManagerDashboard />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/manager/payroll/:workspaceId/:roleId?"
                        element={
                            <ProtectedRoute>
                                <ManagerPayroll />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/manager/settings/:workspaceId/:roleId?"
                        element={
                            <ProtectedRoute>
                                <ManagerSettings />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/manager/roles/:workspaceId"
                        element={
                            <ProtectedRoute>
                                <ManagerRoleManagement />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/employee/dashboard/:workspaceId"
                        element={
                            <ProtectedRoute>
                                <EmployeeDashboard />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/employee/availability/:workspaceId"
                        element={
                            <ProtectedRoute>
                                <EmployeeAvailability />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/employee/earnings/:workspaceId"
                        element={
                            <ProtectedRoute>
                                <EmployeeEarnings />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/employee/roles/:workspaceId"
                        element={
                            <ProtectedRoute>
                                <EmployeeRoleSelection />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/profile"
                        element={
                            <ProtectedRoute>
                                <ProfileDemo />
                            </ProtectedRoute>
                        }
                    />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    )
}

export default App
