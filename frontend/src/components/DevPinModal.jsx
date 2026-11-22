import React, { useState, useEffect, useRef } from 'react';
import { Lock, Unlock, X, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function DevPinModal({ isOpen, onClose, onSuccess }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(false);
      setSuccess(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDigit = (digit) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(false);

      if (nextPin.length === 4) {
        verifyPin(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(false);
  };

  const handleClear = () => {
    setPin('');
    setError(false);
  };

  const verifyPin = (enteredPin) => {
    if (enteredPin === '0161') {
      setSuccess(true);
      setError(false);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 400);
    } else {
      setError(true);
      setSuccess(false);
      setTimeout(() => {
        setPin('');
      }, 800);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      handleDigit(e.key);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      handleBackspace();
    } else if (e.key === 'Delete') {
      e.preventDefault();
      handleClear();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl border border-slate-700 bg-slate-800 p-2 text-slate-300 transition hover:bg-slate-700 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header Icon */}
        <div className="flex flex-col items-center text-center">
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-2xl border transition-all duration-300 ${
              success
                ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-400 shadow-lg shadow-emerald-500/30'
                : error
                ? 'border-rose-500/50 bg-rose-500/20 text-rose-400 shadow-lg shadow-rose-500/30'
                : 'border-purple-500/40 bg-purple-500/15 text-purple-400 shadow-lg shadow-purple-950/50'
            }`}
          >
            {success ? (
              <Unlock className="h-8 w-8 animate-bounce" />
            ) : (
              <Lock className="h-8 w-8" />
            )}
          </div>

          <h3 className="mt-4 text-xl font-black text-white sm:text-2xl">
            Developer PIN Required
          </h3>
          <p className="mt-1 text-xs text-slate-400 sm:text-sm">
            Enter PIN to access Camera Previews &amp; Debugging
          </p>
        </div>

        {/* Hidden Input for Keyboard Accessibility */}
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '').slice(0, 4);
            setPin(val);
            if (val.length === 4) verifyPin(val);
          }}
          className="sr-only"
          autoFocus
        />

        {/* 4 PIN Digit Indicators */}
        <div className="my-6 flex justify-center gap-3">
          {[0, 1, 2, 3].map((idx) => {
            const hasDigit = pin.length > idx;
            return (
              <div
                key={idx}
                className={`flex h-14 w-12 items-center justify-center rounded-2xl border-2 text-2xl font-black transition-all duration-200 ${
                  error
                    ? 'border-rose-500 bg-rose-950/40 text-rose-300 animate-shake'
                    : success
                    ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300'
                    : hasDigit
                    ? 'border-purple-400 bg-purple-950/40 text-purple-200 shadow-md shadow-purple-950/50 scale-105'
                    : 'border-slate-800 bg-slate-950 text-slate-600'
                }`}
              >
                {hasDigit ? pin[idx] : '•'}
              </div>
            );
          })}
        </div>

        {/* Status / Error Message */}
        <div className="h-6 text-center text-xs font-bold">
          {error && (
            <span className="flex items-center justify-center gap-1.5 text-rose-400">
              <AlertCircle className="h-4 w-4" />
              <span>Incorrect PIN. Please enter 0161</span>
            </span>
          )}
          {success && (
            <span className="flex items-center justify-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              <span>Access Granted! Loading debug previews...</span>
            </span>
          )}
          {!error && !success && (
            <span className="text-slate-500">Hint: Default PIN is 0161</span>
          )}
        </div>

        {/* On-Screen Numeric Keypad (Touch / Remote / Mouse Friendly) */}
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleDigit(num)}
              className="flex h-12 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/90 text-lg font-black text-white transition hover:border-purple-500/50 hover:bg-slate-800 active:scale-95"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={handleClear}
            className="flex h-12 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/70 text-xs font-bold uppercase text-slate-400 transition hover:bg-slate-800 hover:text-white active:scale-95"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="flex h-12 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/90 text-lg font-black text-white transition hover:border-purple-500/50 hover:bg-slate-800 active:scale-95"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="flex h-12 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/70 text-xs font-bold uppercase text-slate-400 transition hover:bg-slate-800 hover:text-white active:scale-95"
          >
            ⌫
          </button>
        </div>
      </div>
    </div>
  );
}
