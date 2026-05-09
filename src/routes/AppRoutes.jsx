// src/routes/AppRoutes.jsx
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import SplashPage         from "../pages/Splash/SplashPage.jsx";
import LoginPage          from "../pages/Auth/LoginPage.jsx";
import SignupPage         from "../pages/Auth/SignupPage.jsx";       // ← NEW
import OtpPage            from "../pages/Auth/OtpPage.jsx";
import RegisterPage       from "../pages/Auth/RegisterPage.jsx";     // ← NEW
import ProfileFormPage    from "../pages/Auth/ProfileFormPage.jsx";
import ProfilePage        from "../pages/Auth/ProfilePage.jsx";
import ChoicePage         from "../pages/Auth/ChoicePage.jsx";
import ForgotPasswordPage from "../pages/Auth/ForgotPasswordPage.jsx";

import ConnectDevicePage   from "../pages/Device/ConnectDevicePage.jsx";
import OverviewPage        from "../pages/Device/OverviewPage.jsx";
import TopupPage           from "../pages/Device/TopupPage.jsx";
import UsagePage           from "../pages/Device/UsagePage.jsx";
import PaymentsPage        from "../pages/Device/PaymentsPage.jsx";
import WalletPage          from "../pages/Device/WalletPage.jsx";

import ProductListPage     from "../pages/Product/ProductListPage.jsx";
import ProductCheckoutPage from "../pages/Product/ProductCheckoutPage.jsx";
import SubscriptionPage    from "../pages/Product/SubscriptionPage.jsx";

import ReferPage           from "../pages/Refer/ReferPage.jsx";

import ProtectedRoute      from "./ProtectedRoute.jsx";
import PublicLayout        from "../layouts/PublicLayout.jsx";
import DashboardLayout     from "../layouts/DashboardLayout.jsx";

const AppRoutes = () => {
  return (
    <Routes>
      {/* Splash — always first entry */}
      <Route path="/" element={<SplashPage />} />

      {/* ── Public / Auth routes ── */}
      <Route element={<PublicLayout />}>
        <Route path="/login"           element={<LoginPage />} />
        <Route path="/signup"          element={<SignupPage />} />
        <Route path="/otp"             element={<OtpPage />} />
        <Route path="/register"        element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/profile"         element={<ProfileFormPage />} />
        <Route path="/profile-page"    element={<ProfilePage />} />
        <Route path="/choice"          element={<ChoicePage />} />
      </Route>

      {/* ── Protected logged-in routes ── */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/device/connect"     element={<ConnectDevicePage />} />
          <Route path="/dashboard"          element={<OverviewPage />} />
          <Route path="/dashboard/topup"    element={<TopupPage />} />
          <Route path="/dashboard/usage"    element={<UsagePage />} />
          <Route path="/dashboard/payments" element={<PaymentsPage />} />
          <Route path="/dashboard/wallet"   element={<WalletPage />} />
          <Route path="/refer"              element={<ReferPage />} />
          <Route path="/product"            element={<ProductListPage />} />
          <Route path="/product/checkout"   element={<ProductCheckoutPage />} />
          <Route path="/subscription"       element={<SubscriptionPage />} />
        </Route>
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;