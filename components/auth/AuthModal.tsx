'use client'

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { MailWarning, Loader2, X, UserPlusIcon, LogInIcon, CheckCircleIcon, MailIcon, LockIcon, EyeIcon, EyeOffIcon, User, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useForm } from 'react-hook-form';

type AuthMode = 'login' | 'register' | 'verify';

type FormData = {
  email: string;
  password: string;
  confirmPassword?: string;
  name: string;
  family_name: string;
  location: string;
};

// Country data with regions
const countries = {
  'English Speaking': [
    'United States', 'Canada', 'United Kingdom', 'Australia', 'New Zealand', 'Ireland'
  ],
  'EU Countries': [
    'Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Belgium', 'Sweden',
    'Poland', 'Austria', 'Denmark', 'Finland', 'Portugal', 'Czech Republic'
  ],
  'Asia Pacific': [
    'Japan', 'South Korea', 'Singapore', 'China', 'Taiwan', 'Hong Kong'
  ],
  'Other Developed': [
    'Switzerland', 'Norway', 'Israel', 'United Arab Emirates'
  ]
};

// Type for the countries object
type CountriesType = {
  [key: string]: string[];
};

export default function AuthModal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get('auth') as AuthMode | null;
  
  const [mode, setMode] = useState<AuthMode>(initialMode || 'login');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [accountExists, setAccountExists] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [emailForVerification, setEmailForVerification] = useState('');
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormData>();

  const passwordValue = watch("password");
  const emailValue = watch("email");
  const locationValue = watch("location");

  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
    }
  }, [initialMode]);

  useEffect(() => {
    if (cooldown > 0) {
      const interval = setInterval(() => {
        setCooldown((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [cooldown]);

  const closeModal = () => {
    router.push('/');
  };

  const checkEmailExists = async (email: string) => {
    try {
      const response = await fetch('/api/check-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error('Failed to check email');
      }

      const data = await response.json();
      return data.exists;
    } catch (error) {
      console.error('Email check error:', error);
      return false;
    }
  };

  const handleRegister = async (data: FormData) => {
    if (data.password !== data.confirmPassword) {
      setSubmitError("Passwords don't match");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setAccountExists(false);
    setSuccessMessage(null);

    try {
      const emailExists = await checkEmailExists(data.email);
      if (emailExists) {
        setAccountExists(true);
        setIsSubmitting(false);
        return;
      }

      const response = await fetch('/api/register-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          name: data.name,
          family_name: data.family_name,
          location: data.location
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Registration failed');
      }

      setEmailForVerification(data.email);
      setSuccessMessage(result.message);
      setMode('verify');
      reset();
    } catch (error: any) {
      console.error('Registration error:', error);
      setSubmitError(error.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async (data: FormData) => {
    setIsSubmitting(true);
    setSubmitError(null);
    setEmailForVerification(data.email);

    if (!supabase) {
      console.error("Supabase not initialized");
      router.push("/auth/error?code=supabase_init");
      return;
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) throw error;

      closeModal();
      setTimeout(() => router.push('/'), 100);

    } catch (error: any) {
      console.error('Login error:', error);
      if (error.message.includes('not confirmed')) {
        setSubmitError('Email not confirmed.');
      } else {
        setSubmitError(error.message || 'Login failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resendVerification = async (email?: string) => {
    if (cooldown > 0) return;

    const emailToUse = email || emailForVerification;
    
    if (!emailToUse) {
      setSubmitError("Email address is required");
      return;
    }

    if (!supabase) {
      console.error("Supabase not initialized");
      router.push("/auth/error?code=supabase_init");
      return;
    }

    setIsResending(true);
    setSubmitError(null);
    setSuccessMessage(null);
    
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: emailToUse,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;

      setCooldown(60);
      setSuccessMessage('Verification email resent successfully!');
    } catch (error: any) {
      setSubmitError(error.message || 'Failed to resend verification email');
    } finally {
      setIsResending(false);
    }
  };

  const selectLocation = (country: string) => {
    setValue('location', country, { shouldValidate: true });
    setShowLocationDropdown(false);
    setLocationSearch('');
  };

  // Filter countries based on search
  const filteredCountries = Object.entries(countries).reduce((acc, [region, countryList]) => {
    const filtered = countryList.filter(country => 
      country.toLowerCase().includes(locationSearch.toLowerCase())
    );
    if (filtered.length > 0) {
      (acc as CountriesType)[region] = filtered;
    }
    return acc;
  }, {} as CountriesType);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showLocationDropdown && !target.closest('.location-dropdown-container')) {
        setShowLocationDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showLocationDropdown]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={closeModal} />
        
        <div className="relative bg-white dark:bg-gray-950/90 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-200 dark:border-gray-800 w-full max-w-md mx-auto overflow-hidden">
          <button
            onClick={closeModal}
            className="absolute top-4 right-4 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors z-10"
          >
            <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>

          {mode === 'login' && (
            <div className="p-8">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 mb-4">
                  <LogInIcon className="h-8 w-8 text-gray-700 dark:text-gray-300" />
                </div>
                <h1 className="text-2xl font-light text-gray-900 dark:text-white mb-2">Welcome Back</h1>
                <p className="text-gray-600 dark:text-gray-400 text-sm font-light">
                  Sign in to your Northline Finance account
                </p>
              </div>

              {submitError && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/60 rounded-lg text-red-700 dark:text-red-400 text-sm">
                  <div className="flex flex-col gap-2">
                    <div>{submitError}</div>
                    {submitError.includes('not confirmed') && emailForVerification && (
                      <Button
                        variant="link"
                        size="sm"
                        className="w-fit p-0 h-auto text-red-700 dark:text-red-400 hover:underline font-light"
                        onClick={() => {
                          setMode('verify');
                          setSuccessMessage(null);
                        }}
                      >
                        Resend verification email
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {successMessage && (
                <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/60 rounded-lg text-green-700 dark:text-green-400 text-sm flex items-center">
                  <CheckCircleIcon className="h-5 w-5 mr-2" />
                  {successMessage}
                </div>
              )}

              <form onSubmit={handleSubmit(handleLogin)} className="space-y-5">
                <div>
                  <label htmlFor="email" className="block text-sm font-light text-gray-700 dark:text-gray-300 mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MailIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    </div>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      className={`block w-full pl-10 pr-4 py-3 rounded-lg border ${errors.email ? 'border-red-500 dark:border-red-700' : 'border-gray-300 dark:border-gray-700'} bg-white dark:bg-gray-900/50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-gray-600 focus:border-transparent text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 transition-all font-light`}
                      placeholder="you@example.com"
                      {...register('email', { 
                        required: 'Email is required',
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: 'Invalid email address'
                        } 
                      })}
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-500 font-light">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-light text-gray-700 dark:text-gray-300 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <LockIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    </div>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      className={`block w-full pl-10 pr-12 py-3 rounded-lg border ${errors.password ? 'border-red-500 dark:border-red-700' : 'border-gray-300 dark:border-gray-700'} bg-white dark:bg-gray-900/50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-gray-600 focus:border-transparent text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 transition-all font-light`}
                      placeholder="Enter your password"
                      {...register('password', { 
                        required: 'Password is required', 
                      })}
                    />
                    <div 
                      className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 transition-colors" 
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOffIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" /> : <EyeIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />}
                    </div>
                  </div>
                  {errors.password && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-500 font-light">{errors.password.message}</p>
                  )}
                </div>

                <div>
                  <Button 
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center font-light"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        <span className="text-sm">Signing in...</span>
                      </>
                    ) : (
                      <>
                        <span className="text-sm">Sign in</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>

              <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400 font-light">
                Don't have an account?{' '}
                <button 
                  onClick={() => setMode('register')}
                  className="font-light text-blue-600 dark:text-gray-300 hover:text-blue-700 dark:hover:text-white transition-colors"
                >
                  Sign up
                </button>
              </div>
            </div>
          )}

          {mode === 'register' && (
            <div className="p-8">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 mb-4">
                  <UserPlusIcon className="h-8 w-8 text-gray-700 dark:text-gray-300" />
                </div>
                <h1 className="text-2xl font-light text-gray-900 dark:text-white mb-2">Create an Account</h1>
                <p className="text-gray-600 dark:text-gray-400 text-sm font-light">
                  Join Northline Finance to access premium financial insights
                </p>
              </div>

              {submitError && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/60 rounded-lg text-red-700 dark:text-red-400 text-sm font-light">
                  {submitError}
                </div>
              )}

              {accountExists && (
                <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/60 rounded-lg text-yellow-700 dark:text-yellow-400 text-sm font-light">
                  An account with this email already exists. Please{' '}
                  <button 
                    onClick={() => setMode('login')}
                    className="font-light underline hover:text-yellow-800 dark:hover:text-yellow-300 transition-colors"
                  >
                    log in
                  </button>{' '}
                  instead.
                </div>
              )}

              {successMessage && (
                <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/60 rounded-lg text-green-700 dark:text-green-400 text-sm flex items-center font-light">
                  <CheckCircleIcon className="h-5 w-5 mr-2" />
                  {successMessage}
                </div>
              )}

              <form onSubmit={handleSubmit(handleRegister)} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-light text-gray-700 dark:text-gray-300 mb-2">
                      First Name
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                      </div>
                      <input
                        id="name"
                        type="text"
                        autoComplete="given-name"
                        className={`block w-full pl-10 pr-4 py-3 rounded-lg border ${errors.name ? 'border-red-500 dark:border-red-700' : 'border-gray-300 dark:border-gray-700'} bg-white dark:bg-gray-900/50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-gray-600 focus:border-transparent text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 transition-all font-light`}
                        placeholder="John"
                        {...register('name', { 
                          required: 'First name is required',
                        })}
                      />
                    </div>
                    {errors.name && (
                      <p className="mt-2 text-sm text-red-600 dark:text-red-500 font-light">{errors.name.message}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="family_name" className="block text-sm font-light text-gray-700 dark:text-gray-300 mb-2">
                      Last Name
                    </label>
                    <input
                      id="family_name"
                      type="text"
                      autoComplete="family-name"
                      className={`block w-full px-4 py-3 rounded-lg border ${errors.family_name ? 'border-red-500 dark:border-red-700' : 'border-gray-300 dark:border-gray-700'} bg-white dark:bg-gray-900/50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-gray-600 focus:border-transparent text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 transition-all font-light`}
                      placeholder="Doe"
                      {...register('family_name', { 
                        required: 'Last name is required',
                      })}
                    />
                    {errors.family_name && (
                      <p className="mt-2 text-sm text-red-600 dark:text-red-500 font-light">{errors.family_name.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-light text-gray-700 dark:text-gray-300 mb-2">
                    Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MailIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    </div>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      className={`block w-full pl-10 pr-4 py-3 rounded-lg border ${errors.email ? 'border-red-500 dark:border-red-700' : 'border-gray-300 dark:border-gray-700'} bg-white dark:bg-gray-900/50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-gray-600 focus:border-transparent text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 transition-all font-light`}
                      placeholder="you@example.com"
                      {...register('email', { 
                        required: 'Email is required',
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: 'Invalid email address'
                        } 
                      })}
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-500 font-light">{errors.email.message}</p>
                  )}
                </div>

                <div className="location-dropdown-container">
                  <label htmlFor="location" className="block text-sm font-light text-gray-700 dark:text-gray-300 mb-2">
                    Location
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <MapPin className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    </div>
                    <input
                      id="location"
                      type="text"
                      autoComplete="off"
                      className={`block w-full pl-10 pr-4 py-3 rounded-lg border ${errors.location ? 'border-red-500 dark:border-red-700' : 'border-gray-300 dark:border-gray-700'} bg-white dark:bg-gray-900/50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-gray-600 focus:border-transparent text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 transition-all font-light cursor-pointer`}
                      placeholder="Select your country"
                      value={locationValue || ''}
                      readOnly
                      onClick={() => setShowLocationDropdown(!showLocationDropdown)}
                      {...register('location', { 
                        required: 'Location is required',
                      })}
                    />
                    {showLocationDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-2xl z-20 max-h-80 overflow-y-auto">
                        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                          <input
                            type="text"
                            placeholder="Search countries..."
                            value={locationSearch}
                            onChange={(e) => setLocationSearch(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-gray-600 font-light"
                            autoFocus
                          />
                        </div>
                        <div className="p-2">
                          {Object.entries(filteredCountries).map(([region, countryList]) => (
                            <div key={region} className="mb-2">
                              <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-500 font-medium uppercase tracking-wider">
                                {region}
                              </div>
                              {countryList.map((country) => (
                                <button
                                  key={country}
                                  type="button"
                                  onClick={() => selectLocation(country)}
                                  className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded font-light transition-colors"
                                >
                                  {country}
                                </button>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  {errors.location && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-500 font-light">{errors.location.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-light text-gray-700 dark:text-gray-300 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <LockIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    </div>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      className={`block w-full pl-10 pr-12 py-3 rounded-lg border ${errors.password ? 'border-red-500 dark:border-red-700' : 'border-gray-300 dark:border-gray-700'} bg-white dark:bg-gray-900/50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-gray-600 focus:border-transparent text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 transition-all font-light`}
                      placeholder="Enter your password"
                      {...register('password', { 
                        required: 'Password is required', 
                        minLength: { value: 8, message: 'Password must be at least 8 characters' },
                      })}
                    />
                    <div 
                      className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 transition-colors" 
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOffIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" /> : <EyeIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />}
                    </div>
                  </div>
                  {errors.password && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-500 font-light">{errors.password.message}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-light text-gray-700 dark:text-gray-300 mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <LockIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    </div>
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      className={`block w-full pl-10 pr-12 py-3 rounded-lg border ${errors.confirmPassword ? 'border-red-500 dark:border-red-700' : 'border-gray-300 dark:border-gray-700'} bg-white dark:bg-gray-900/50 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-gray-600 focus:border-transparent text-gray-900 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 transition-all font-light`}
                      placeholder="Confirm your password"
                      {...register('confirmPassword', { 
                        required: 'Please confirm your password',
                        validate: (value) => value === passwordValue || "Passwords don't match",
                      })}
                    />
                    <div 
                      className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 transition-colors" 
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOffIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" /> : <EyeIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />}
                    </div>
                  </div>
                  {errors.confirmPassword && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-500 font-light">{errors.confirmPassword.message}</p>
                  )}
                </div>

                <div>
                  <Button 
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center font-light"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        <span className="text-sm">Creating account...</span>
                      </>
                    ) : (
                      <>
                        <span className="text-sm">Create Account</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>

              <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400 font-light">
                Already have an account?{' '}
                <button 
                  onClick={() => setMode('login')}
                  className="font-light text-blue-600 dark:text-gray-300 hover:text-blue-700 dark:hover:text-white transition-colors"
                >
                  Log in
                </button>
              </div>
            </div>
          )}

          {mode === 'verify' && (
            <div className="p-8">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 mb-4">
                  <MailWarning className="h-8 w-8 text-gray-700 dark:text-gray-300" />
                </div>
                <h1 className="text-2xl font-light text-gray-900 dark:text-white mb-2">
                  Verify Your Email
                </h1>
                <p className="text-gray-600 dark:text-gray-400 text-sm font-light mb-6">
                  We've sent a verification link to <span className="font-medium text-gray-800 dark:text-gray-300">{emailForVerification}</span>.
                </p>

                {submitError && (
                  <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/60 rounded-lg text-red-700 dark:text-red-400 text-sm font-light">
                    {submitError}
                  </div>
                )}

                {successMessage && (
                  <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/60 rounded-lg text-green-700 dark:text-green-400 text-sm flex items-center font-light">
                    <CheckCircleIcon className="h-5 w-5 mr-2" />
                    {successMessage}
                  </div>
                )}

                <div className="space-y-4">
                  <Button
                    onClick={() => resendVerification()}
                    disabled={isResending || cooldown > 0}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-light"
                  >
                    {isResending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : cooldown > 0 ? (
                      `Wait ${cooldown}s`
                    ) : (
                      'Resend Verification Email'
                    )}
                  </Button>

                  <Button
                    variant="outline"
                    onClick={closeModal}
                    className="w-full border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white font-light"
                  >
                    Back to Home Page
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
