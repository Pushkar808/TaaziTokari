// ==============================================================================
// TAAZI TOKARI (ताज़ी टोकरी) - APPLICATION ROOT ROUTER & ORCHESTRATOR
// Loads the session and data from the backend API on boot, then routes between the
// customer portal and the admin console (admin role comes from the database).
// ==============================================================================

import React, { useState, useEffect } from 'react';
import { CustomerPortal } from './components/customer/CustomerPortal';
import { AdminPortal } from './components/admin/AdminPortal';
import { OpsPortal } from './components/ops/OpsPortal';
import { LocationModal } from './components/location/LocationModal';
import { AuthModal } from './components/auth/AuthModal';
import { UserProfile, CustomerAddress, appStore } from './services/store';
import { authService } from './services/auth';
import { GlobalLoader } from './components/common/GlobalLoader';

export default function App() {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activePortal, setActivePortal] = useState<'customer' | 'admin'>('customer');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [currentAddress, setCurrentAddress] = useState<CustomerAddress | null>(null);

  // Restore session and load data on boot
  useEffect(() => {
    (async () => {
      try {
        const user = await authService.initSession();
        await appStore.init(user);
        setCurrentUser(user);
        if (user?.role === 'admin') setActivePortal('admin');
        setCurrentAddress(appStore.getActiveAddress());
        if (user?.role !== 'operations' && !appStore.isLocationSetupDone()) setIsLocationModalOpen(true);
        setReady(true);
      } catch (err: any) {
        setLoadError(err.message || 'Could not load Taazi Tokari. Please try again.');
      }
    })();
  }, []);

  // Handle successful login or registration
  const handleAuthSuccess = async (user: UserProfile) => {
    await appStore.init(user);
    setCurrentUser(user);
    setCurrentAddress(appStore.getActiveAddress());
    // One sign-in for everyone: the role stored with the account decides where they land.
    setActivePortal(user.role === 'admin' ? 'admin' : 'customer');
  };

  // Handle logout
  const handleSignOut = async () => {
    await authService.signOut();
    await appStore.init(null);
    appStore.clearCart();
    setCurrentUser(null);
    setCurrentAddress(appStore.getActiveAddress());
    setActivePortal('customer');
  };

  // Switch to admin portal safely
  const handleSwitchToAdmin = () => {
    if (currentUser?.role === 'admin') {
      setActivePortal('admin');
    } else {
      setIsAuthModalOpen(true);
    }
  };

  if (loadError || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8faf8] text-[#151e17] text-sm font-semibold px-6 text-center">
        <div className="flex flex-col items-center gap-3">
          {!loadError && <div className="w-8 h-8 border-4 border-[#d7e6d9] border-t-[#2f7d3c] rounded-full animate-spin" />}
          {loadError ? `⚠️ ${loadError}` : 'Loading fresh harvest…'}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8faf8] text-[#151e17] flex flex-col font-sans">
      {/* 1. PORTAL ROUTING */}
      {currentUser?.role === 'operations' ? (
        <OpsPortal currentUser={currentUser} onSignOut={handleSignOut} />
      ) : activePortal === 'admin' && currentUser?.role === 'admin' ? (
        <AdminPortal
          currentUser={currentUser}
          onSwitchToCustomer={() => setActivePortal('customer')}
          onSignOut={handleSignOut}
        />
      ) : (
        <CustomerPortal
          key={currentUser?.id ?? 'guest'}
          currentUser={currentUser}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onOpenLocation={() => setIsLocationModalOpen(true)}
          onSwitchToAdmin={currentUser?.role === 'admin' ? handleSwitchToAdmin : undefined}
          onSignOut={handleSignOut}
        />
      )}

      {/* 2. LOCATION & SERVICEABILITY MODAL */}
      <LocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        currentAddress={currentAddress}
        onAddressSelected={(addr) => {
          setCurrentAddress(addr);
          appStore.setActiveAddress(addr);
        }}
      />

      {/* 3. AUTHENTICATION & REGISTRATION MODAL */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      <GlobalLoader />
    </div>
  );
}
