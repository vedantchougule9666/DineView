import React, { useState } from 'react';
import { Sparkles, Phone, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { formatPhone, getCustomerProfile } from '../services/customerService';

export const COUNTRY_CODES = [
  { code: '+91', country: 'IN', label: '+91 (India)', digits: 10 },
  { code: '+1', country: 'US', label: '+1 (US/Canada)', digits: 10 },
  { code: '+44', country: 'GB', label: '+44 (UK)', digits: 10 },
  { code: '+971', country: 'AE', label: '+971 (UAE)', digits: 9 },
  { code: '+65', country: 'SG', label: '+65 (Singapore)', digits: 8 },
  { code: '+61', country: 'AU', label: '+61 (Australia)', digits: 9 },
];

export interface PhoneGateModalProps {
  isOpen: boolean;
  tableId?: string;
  tableName?: string;
  onSuccess: (normalizedPhone: string) => void;
}

export const PhoneGateModal: React.FC<PhoneGateModalProps> = ({
  isOpen,
  tableId,
  tableName,
  onSuccess,
}) => {
  const [countryCode, setCountryCode] = useState<string>('+91');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentCountry = COUNTRY_CODES.find((c) => c.code === countryCode) || COUNTRY_CODES[0];
  const requiredDigits = currentCountry.digits || 10;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits
    const cleaned = e.target.value.replace(/\D/g, '');
    if (cleaned.length <= 12) {
      setPhoneNumber(cleaned);
      if (error) setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = phoneNumber.trim();

    // Validate 10 digits (or country specific required digits)
    if (!cleaned) {
      setError('Please enter your mobile phone number.');
      return;
    }

    if (cleaned.length !== requiredDigits) {
      setError(`Please enter a valid ${requiredDigits}-digit mobile number.`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const normalizedPhone = formatPhone(`${countryCode}${cleaned}`);

    try {
      // 1. Save to localStorage immediately
      localStorage.setItem('dineview_phone', normalizedPhone);

      // 2. Fetch existing customer profile from Firestore / cache
      const profile = await getCustomerProfile(normalizedPhone);

      // 3. Dispatch global event so FoodAssistantModal and other components update immediately
      window.dispatchEvent(
        new CustomEvent('dineview:phone_updated', {
          detail: { phone: normalizedPhone, profile },
        })
      );

      // 4. Trigger success callback to dismiss gate
      onSuccess(normalizedPhone);
    } catch (err) {
      console.warn('Phone gate save notice:', err);
      // Still proceed with normalized phone stored locally
      onSuccess(normalizedPhone);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[200] bg-neutral-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-labelledby="phone-gate-title"
    >
      <div className="w-full max-w-md bg-white border border-border shadow-2xl rounded-sm p-6 sm:p-8 relative animate-in zoom-in-95 duration-200">
        {/* Table & Branding Crest */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-bold uppercase tracking-widest mb-3">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span>AI Dining Concierge</span>
          </div>

          <h2 id="phone-gate-title" className="text-2xl sm:text-3xl font-serif text-text-primary mb-2">
            Welcome to DineView
          </h2>
          
          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
            Please enter your mobile phone number to access the digital menu. Our AI Concierge will remember your dining preferences and past favorites.
          </p>

          {/* Table Assignment Badge */}
          {tableId && tableId !== 'COUNTER' && (
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
              <span>Ordering at {tableName || `Table ${tableId}`}</span>
            </div>
          )}
        </div>

        {/* Mandatory Phone Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-text-primary mb-2">
              Mobile Phone Number <span className="text-red-500">*</span>
            </label>

            <div className="flex gap-2">
              {/* Country Code Selector */}
              <select
                value={countryCode}
                onChange={(e) => {
                  setCountryCode(e.target.value);
                  setError(null);
                }}
                className="border border-border bg-bg-primary px-3 py-2.5 rounded-sm text-xs font-medium text-text-primary focus:outline-none focus:border-text-primary shrink-0"
                aria-label="Country Code"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>

              {/* Phone Input */}
              <div className="relative flex-1">
                <input
                  type="tel"
                  inputMode="numeric"
                  autoFocus
                  required
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  placeholder="10-digit mobile number"
                  className={`w-full border ${
                    error ? 'border-red-500' : 'border-border'
                  } px-3 py-2.5 rounded-sm text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-primary font-mono`}
                  aria-invalid={Boolean(error)}
                />
              </div>
            </div>

            {error ? (
              <p className="mt-2 text-xs text-red-600 flex items-center gap-1 animate-in fade-in">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </p>
            ) : (
              <p className="mt-2 text-[11px] text-text-muted flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-accent shrink-0" />
                <span>Required for AI recommendations & table order updates.</span>
              </p>
            )}
          </div>

          {/* Compulsory Submit Button (NO SKIP) */}
          <button
            type="submit"
            disabled={isSubmitting || phoneNumber.length !== requiredDigits}
            className="w-full bg-text-primary text-white py-3.5 px-6 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-[#333] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md mt-6"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Unlocking Menu...</span>
              </>
            ) : (
              <>
                <span>Save & Continue</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Guarantee Info */}
        <div className="mt-6 pt-4 border-t border-border/60 text-center">
          <p className="text-[10px] text-text-muted">
            Phone verification is compulsory for table orders and AI concierge history.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PhoneGateModal;
