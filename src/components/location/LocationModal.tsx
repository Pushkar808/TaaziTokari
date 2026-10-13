// ==============================================================================
// TAAZI TOKARI (ताज़ी टोकरी) - LOCATION & DELIVERY AVAILABILITY MODAL
// Geolocation detection, OpenStreetMap reverse geocoding, active delivery
// zone verification, slot preview, and manual address entry fallback.
// ==============================================================================

import React, { useState } from 'react';
import { CustomerAddress, DeliveryZone, appStore } from '../../services/store';
import { TaaziTokariEmblem } from '../BrandLogo';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddressSelected: (address: CustomerAddress) => void;
  currentAddress?: CustomerAddress | null;
}

export const LocationModal: React.FC<LocationModalProps> = ({
  isOpen,
  onClose,
  onAddressSelected,
  currentAddress,
}) => {
  const [step, setStep] = useState<'intro' | 'detecting' | 'confirm' | 'manual'>('intro');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [zones] = useState<DeliveryZone[]>(appStore.getDeliveryZones());

  // Form states
  const [recipientName, setRecipientName] = useState(
    currentAddress?.recipientName || appStore.getCurrentUser()?.fullName || ''
  );
  const [phoneNumber, setPhoneNumber] = useState(
    currentAddress?.phoneNumber || appStore.getCurrentUser()?.phoneNumber || ''
  );
  const [flatNumber, setFlatNumber] = useState(currentAddress?.flatNumber || '');
  const [blockBuilding, setBlockBuilding] = useState(
    currentAddress?.blockBuilding || 'Eldeco Elegance, Tower B'
  );
  const [addressLine, setAddressLine] = useState(
    currentAddress?.addressLine || 'Gomti Nagar Phase 2, Lucknow'
  );
  const [landmark, setLandmark] = useState(currentAddress?.landmark || '');
  const [pincode, setPincode] = useState(currentAddress?.pincode || '226010');
  const [selectedZoneId, setSelectedZoneId] = useState<string>(
    currentAddress?.zoneId || zones[0]?.id || ''
  );
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | undefined>(
    currentAddress?.coordinates
  );

  if (!isOpen) return null;

  // Detect location via HTML5 Geolocation API
  const handleDetectLocation = () => {
    setErrorMsg(null);
    setStep('detecting');

    if (!('geolocation' in navigator)) {
      setErrorMsg('Browser geolocation is not supported on this device. Please select your area manually.');
      setStep('manual');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setCoords({ latitude, longitude });

        try {
          // Keyless reverse geocoding via OpenStreetMap Nominatim
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
            { headers: { 'Accept-Language': 'en' } }
          );

          if (response.ok) {
            const data = await response.json();
            const addr = data.address || {};
            const road = addr.road || addr.suburb || addr.neighbourhood || 'Gomti Nagar';
            const city = addr.city || addr.town || 'Lucknow';
            const pin = addr.postcode || '226010';

            setAddressLine(`${road}, ${city}`);
            setPincode(pin);

            // Match zone by pincode
            const matchedZone = zones.find((z) => z.pincodes.includes(pin));
            if (matchedZone) {
              setSelectedZoneId(matchedZone.id);
            }
          }
        } catch {
          // If reverse geocoding API has network issue, continue with coordinates
          setAddressLine(`Near Coordinates (${latitude.toFixed(3)}, ${longitude.toFixed(3)}), Lucknow`);
        }

        setStep('confirm');
      },
      (error) => {
        let msg = 'Unable to detect coordinates.';
        if (error.code === error.PERMISSION_DENIED) {
          msg = 'Location permission was denied. You can easily choose your area below.';
        } else if (error.code === error.TIMEOUT) {
          msg = 'Location request timed out. Please enter your address manually.';
        }
        setErrorMsg(msg);
        setStep('manual');
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName.trim() || !phoneNumber.trim() || !flatNumber.trim() || !addressLine.trim()) {
      setErrorMsg('Please fill in recipient name, phone, flat/house number, and address line.');
      return;
    }

    const matchedZone = zones.find((z) => z.id === selectedZoneId) || zones[0];
    const newAddress: CustomerAddress = {
      id: currentAddress?.id || `addr-${Date.now()}`,
      userId: appStore.getCurrentUser()?.id || 'guest',
      recipientName: recipientName.trim(),
      phoneNumber: phoneNumber.trim(),
      flatNumber: flatNumber.trim(),
      blockBuilding: blockBuilding.trim(),
      addressLine: addressLine.trim(),
      landmark: landmark.trim(),
      zoneId: matchedZone.id,
      pincode: pincode.trim(),
      coordinates: coords,
      isDefault: true,
    };

    try {
      const saved = await appStore.saveUserAddress(newAddress);
      onAddressSelected(saved);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not save your address. Please try again.');
    }
  };

  const activeZone = zones.find((z) => z.id === selectedZoneId) || zones[0];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-xl w-full border border-emerald-100 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#072917] px-6 py-5 text-white flex items-center justify-between border-b border-[#14482a]">
          <div className="flex items-center gap-3">
            <TaaziTokariEmblem size={38} />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-1.5">
                Delivery Location
                <span className="text-xs font-normal text-emerald-300">(वितरण पता)</span>
              </h2>
              <p className="text-xs text-emerald-200/80">
                Determines morning delivery availability & charges
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors text-lg"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {errorMsg && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-2xl text-xs flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}

          {/* STEP 1: INTRO */}
          {step === 'intro' && (
            <div className="space-y-6 text-center py-2">
              <div className="w-16 h-16 mx-auto bg-emerald-50 rounded-full flex items-center justify-center text-3xl text-emerald-700 border border-emerald-200 shadow-inner">
                📍
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Select your neighborhood in Lucknow
                </h3>
                <p className="text-sm text-gray-600 mt-2 max-w-md mx-auto leading-relaxed">
                  Taazi Tokari delivers <strong>freshly harvested morning produce</strong>. Sharing your location helps us confirm dawn dispatch routes, delivery cut-off times, and fee waivers.
                </p>
              </div>

              {/* Service Promise Pill */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 text-left flex items-start gap-3">
                <span className="text-emerald-700 text-xl shrink-0 mt-0.5">🌾</span>
                <div className="text-xs text-emerald-950 space-y-1">
                  <p className="font-bold">Next Morning Guarantee (सुबह 6:00 - 8:30)</p>
                  <p className="text-emerald-800">
                    Order before 10:00 PM tonight for farm harvest directly to your doorstep. Free delivery on orders above ₹199.
                  </p>
                </div>
              </div>

              {/* Primary Actions */}
              <div className="space-y-3 pt-2">
                <button
                  onClick={handleDetectLocation}
                  className="w-full py-3.5 px-4 bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white font-bold text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <span>🎯</span>
                  <span>Detect My Current Location (अनुमति दें)</span>
                </button>

                <button
                  onClick={() => setStep('manual')}
                  className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-2xl transition-all"
                >
                  Enter Address or Society Manually
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: DETECTING SPINNER */}
          {step === 'detecting' && (
            <div className="text-center py-12 space-y-4">
              <div className="inline-block w-12 h-12 border-4 border-emerald-200 border-t-emerald-700 rounded-full animate-spin"></div>
              <p className="text-sm font-semibold text-gray-700">
                Detecting coordinates and checking delivery routes...
              </p>
              <p className="text-xs text-gray-500">
                Please click &quot;Allow&quot; if prompted by your browser.
              </p>
            </div>
          )}

          {/* STEP 3 & 4: CONFIRM DETECTED OR ENTER MANUALLY */}
          {(step === 'confirm' || step === 'manual') && (
            <form onSubmit={handleSaveAddress} className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-900">
                  {step === 'confirm' ? '✓ Location Detected' : 'Manual Address Details'}
                </span>
                <button
                  type="button"
                  onClick={() => setStep('intro')}
                  className="text-xs text-emerald-700 font-semibold hover:underline"
                >
                  ← Change Method
                </button>
              </div>

              {/* Delivery Zone Card */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900">Active Delivery Zone:</span>
                  <span className="bg-emerald-700 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                    Serviceable
                  </span>
                </div>
                <select
                  value={selectedZoneId}
                  onChange={(e) => setSelectedZoneId(e.target.value)}
                  className="w-full bg-white border border-emerald-300 rounded-xl px-3 py-2 text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.name} (Pincodes: {z.pincodes.join(', ')})
                    </option>
                  ))}
                </select>
                <div className="flex items-center justify-between text-[11px] text-emerald-800 pt-1">
                  <span>Standard Delivery: ₹{activeZone.deliveryFee}</span>
                  <span className="font-bold text-emerald-900">
                    Free above ₹{activeZone.minOrderFreeDelivery}
                  </span>
                  <span>Cut-off: {activeZone.cutoffTime}</span>
                </div>
              </div>

              {/* Form Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Recipient Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="e.g. Priya Sharma"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Contact Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Flat / House No. / Villa <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={flatNumber}
                    onChange={(e) => setFlatNumber(e.target.value)}
                    placeholder="e.g. Flat 402 / House 12"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Building / Tower / Society <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={blockBuilding}
                    onChange={(e) => setBlockBuilding(e.target.value)}
                    placeholder="e.g. Tower B, Eldeco Elegance"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Street / Area / Road Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  placeholder="e.g. Gomti Nagar Phase 2, Lucknow"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Landmark (Optional)
                  </label>
                  <input
                    type="text"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    placeholder="e.g. Near Club House / Main Gate"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Pincode <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    placeholder="226010"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-emerald-700 hover:bg-emerald-800 active:scale-[0.99] text-white font-bold text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <span>✓</span>
                  <span>Confirm Address & Start Shopping</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
