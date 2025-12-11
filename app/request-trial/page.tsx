'use client'
import { useState } from 'react'
import Link from 'next/link'

// ============================================================================
// SECTION 1: INTERFACES & TYPES
// ============================================================================

interface FormData {
    // Contact Details
    firstName: string
    lastName: string
    email: string
    phone: string
    jobTitle: string

    // Company Details
    companyName: string
    companySize: string
    industry: string
    website: string

    // Trial Details
    contractValue: string
    useCase: string
    timeline: string
    hearAboutUs: string

    // Consent
    marketingConsent: boolean
}

interface FormErrors {
    [key: string]: string
}

// ============================================================================
// SECTION 2: FORM OPTIONS DATA
// ============================================================================

const companySizeOptions = [
    { value: '', label: 'Select company size' },
    { value: '1-10', label: '1-10 employees' },
    { value: '11-50', label: '11-50 employees' },
    { value: '51-200', label: '51-200 employees' },
    { value: '201-500', label: '201-500 employees' },
    { value: '501-1000', label: '501-1,000 employees' },
    { value: '1001-5000', label: '1,001-5,000 employees' },
    { value: '5000+', label: '5,000+ employees' },
]

const industryOptions = [
    { value: '', label: 'Select industry' },
    { value: 'financial-services', label: 'Financial Services' },
    { value: 'technology', label: 'Technology' },
    { value: 'healthcare', label: 'Healthcare' },
    { value: 'professional-services', label: 'Professional Services' },
    { value: 'manufacturing', label: 'Manufacturing' },
    { value: 'retail', label: 'Retail & Consumer' },
    { value: 'energy', label: 'Energy & Utilities' },
    { value: 'telecommunications', label: 'Telecommunications' },
    { value: 'government', label: 'Government & Public Sector' },
    { value: 'education', label: 'Education' },
    { value: 'legal', label: 'Legal Services' },
    { value: 'bpo', label: 'BPO & Outsourcing' },
    { value: 'other', label: 'Other' },
]

const contractValueOptions = [
    { value: '', label: 'Select typical contract value' },
    { value: 'under-50k', label: 'Under £50,000' },
    { value: '50k-100k', label: '£50,000 - £100,000' },
    { value: '100k-250k', label: '£100,000 - £250,000' },
    { value: '250k-500k', label: '£250,000 - £500,000' },
    { value: '500k-1m', label: '£500,000 - £1 million' },
    { value: '1m-5m', label: '£1 million - £5 million' },
    { value: '5m+', label: 'Over £5 million' },
]

const timelineOptions = [
    { value: '', label: 'Select timeline' },
    { value: 'immediate', label: 'Immediately - I have an active negotiation' },
    { value: '1-month', label: 'Within 1 month' },
    { value: '1-3-months', label: '1-3 months' },
    { value: '3-6-months', label: '3-6 months' },
    { value: 'evaluating', label: 'Just evaluating options' },
]

const hearAboutUsOptions = [
    { value: '', label: 'Select an option' },
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'google', label: 'Google Search' },
    { value: 'referral', label: 'Referral from colleague' },
    { value: 'event', label: 'Industry event or conference' },
    { value: 'article', label: 'Article or blog post' },
    { value: 'other', label: 'Other' },
]

// ============================================================================
// SECTION 3: INITIAL FORM STATE
// ============================================================================

const initialFormData: FormData = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    jobTitle: '',
    companyName: '',
    companySize: '',
    industry: '',
    website: '',
    contractValue: '',
    useCase: '',
    timeline: '',
    hearAboutUs: '',
    marketingConsent: false,
}

// ============================================================================
// SECTION 4: MAIN COMPONENT
// ============================================================================

export default function RequestTrialPage() {
    const [formData, setFormData] = useState<FormData>(initialFormData)
    const [errors, setErrors] = useState<FormErrors>({})
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSubmitted, setIsSubmitted] = useState(false)

    // ============================================================================
    // SECTION 5: FORM VALIDATION
    // ============================================================================

    const validateForm = (): boolean => {
        const newErrors: FormErrors = {}

        // Required fields
        if (!formData.firstName.trim()) newErrors.firstName = 'First name is required'
        if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required'
        if (!formData.email.trim()) {
            newErrors.email = 'Email is required'
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Please enter a valid email address'
        }
        if (!formData.companyName.trim()) newErrors.companyName = 'Company name is required'
        if (!formData.companySize) newErrors.companySize = 'Please select company size'
        if (!formData.industry) newErrors.industry = 'Please select an industry'
        if (!formData.contractValue) newErrors.contractValue = 'Please select typical contract value'
        if (!formData.useCase.trim()) newErrors.useCase = 'Please describe your use case'

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    // ============================================================================
    // SECTION 6: EVENT HANDLERS
    // ============================================================================

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
        const { name, value, type } = e.target
        const checked = (e.target as HTMLInputElement).checked

        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }))

        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => {
                const newErrors = { ...prev }
                delete newErrors[name]
                return newErrors
            })
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!validateForm()) {
            // Scroll to first error
            const firstError = document.querySelector('.error-field')
            firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            return
        }

        setIsSubmitting(true)

        try {
            // TODO: Replace with actual API endpoint
            // await fetch('/api/request-trial', {
            //   method: 'POST',
            //   headers: { 'Content-Type': 'application/json' },
            //   body: JSON.stringify(formData),
            // })

            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500))

            setIsSubmitted(true)
        } catch (error) {
            console.error('Error submitting form:', error)
            setErrors({ submit: 'Something went wrong. Please try again.' })
        } finally {
            setIsSubmitting(false)
        }
    }

    // ============================================================================
    // SECTION 7: HELPER COMPONENTS
    // ============================================================================

    const InputField = ({
        label,
        name,
        type = 'text',
        placeholder,
        required = false,
        value,
    }: {
        label: string
        name: keyof FormData
        type?: string
        placeholder?: string
        required?: boolean
        value: string
    }) => (
        <div className={errors[name] ? 'error-field' : ''}>
            <label htmlFor={name} className="block text-sm font-medium text-slate-700 mb-1">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <input
                type={type}
                id={name}
                name={name}
                value={value}
                onChange={handleInputChange}
                placeholder={placeholder}
                className={`
          w-full px-4 py-2.5 rounded-lg border transition-colors
          ${errors[name]
                        ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                        : 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
                    }
          outline-none
        `}
            />
            {errors[name] && (
                <p className="mt-1 text-sm text-red-600">{errors[name]}</p>
            )}
        </div>
    )

    const SelectField = ({
        label,
        name,
        options,
        required = false,
        value,
    }: {
        label: string
        name: keyof FormData
        options: { value: string; label: string }[]
        required?: boolean
        value: string
    }) => (
        <div className={errors[name] ? 'error-field' : ''}>
            <label htmlFor={name} className="block text-sm font-medium text-slate-700 mb-1">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <select
                id={name}
                name={name}
                value={value}
                onChange={handleInputChange}
                className={`
          w-full px-4 py-2.5 rounded-lg border transition-colors appearance-none
          bg-white bg-no-repeat bg-right
          ${errors[name]
                        ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                        : 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
                    }
          outline-none
        `}
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                    backgroundSize: '1.5rem',
                    backgroundPosition: 'right 0.75rem center',
                    paddingRight: '2.5rem',
                }}
            >
                {options.map(option => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            {errors[name] && (
                <p className="mt-1 text-sm text-red-600">{errors[name]}</p>
            )}
        </div>
    )

    // ============================================================================
    // SECTION 8: SUCCESS STATE RENDER
    // ============================================================================

    if (isSubmitted) {
        return (
            <div className="min-h-screen bg-slate-50">
                {/* Header */}
                <header className="bg-slate-800 text-white">
                    <div className="container mx-auto px-6">
                        <nav className="flex justify-between items-center h-16">
                            <Link href="/" className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                                    <span className="text-white font-bold text-lg">C</span>
                                </div>
                                <div>
                                    <div className="font-semibold text-white tracking-wide">CLARENCE</div>
                                    <div className="text-xs text-slate-400">The Honest Broker</div>
                                </div>
                            </Link>
                        </nav>
                    </div>
                </header>

                {/* Success Message */}
                <div className="container mx-auto px-6 py-20">
                    <div className="max-w-lg mx-auto text-center">
                        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h1 className="text-3xl font-bold text-slate-800 mb-4">
                            Thank You for Your Interest!
                        </h1>
                        <p className="text-lg text-slate-600 mb-8">
                            We've received your trial request and will be in touch within 24 hours to get you started.
                        </p>
                        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
                            <h2 className="font-semibold text-slate-800 mb-3">What happens next?</h2>
                            <ul className="text-left space-y-3">
                                <li className="flex items-start gap-3">
                                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <span className="text-blue-600 text-sm font-semibold">1</span>
                                    </div>
                                    <span className="text-slate-600">Our team will review your request</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <span className="text-blue-600 text-sm font-semibold">2</span>
                                    </div>
                                    <span className="text-slate-600">You'll receive an email with your trial activation</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <span className="text-blue-600 text-sm font-semibold">3</span>
                                    </div>
                                    <span className="text-slate-600">We'll schedule a brief onboarding call if needed</span>
                                </li>
                            </ul>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link
                                href="/"
                                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-all"
                            >
                                Return Home
                            </Link>
                            <Link
                                href="/how-it-works"
                                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all"
                            >
                                Learn How CLARENCE Works
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // ============================================================================
    // SECTION 9: MAIN FORM RENDER
    // ============================================================================

    return (
        <div className="min-h-screen bg-slate-50">
            {/* ================================================================== */}
            {/* SECTION 10: NAVIGATION HEADER */}
            {/* ================================================================== */}
            <header className="bg-slate-800 text-white">
                <div className="container mx-auto px-6">
                    <nav className="flex justify-between items-center h-16">
                        {/* Logo & Brand */}
                        <Link href="/" className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-lg">C</span>
                            </div>
                            <div>
                                <div className="font-semibold text-white tracking-wide">CLARENCE</div>
                                <div className="text-xs text-slate-400">The Honest Broker</div>
                            </div>
                        </Link>

                        {/* Navigation Links */}
                        <div className="flex items-center gap-6">
                            <Link
                                href="/how-it-works"
                                className="text-slate-300 hover:text-white text-sm font-medium transition-colors"
                            >
                                How It Works
                            </Link>
                            <Link
                                href="/phases"
                                className="text-slate-300 hover:text-white text-sm font-medium transition-colors"
                            >
                                The 6 Phases
                            </Link>
                            <Link
                                href="/pricing"
                                className="text-slate-300 hover:text-white text-sm font-medium transition-colors"
                            >
                                Pricing
                            </Link>

                            {/* Sign In Button */}
                            <Link
                                href="/auth/login"
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors ml-2"
                            >
                                Sign In
                            </Link>
                        </div>
                    </nav>
                </div>
            </header>

            {/* ================================================================== */}
            {/* SECTION 11: PAGE CONTENT */}
            {/* ================================================================== */}
            <div className="container mx-auto px-6 py-12">
                <div className="max-w-4xl mx-auto">
                    {/* Page Header */}
                    <div className="text-center mb-10">
                        <h1 className="text-3xl font-bold text-slate-800 mb-4">
                            Request Your Free Trial
                        </h1>
                        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                            Experience CLARENCE with a complete contract negotiation session.
                            Fill out the form below and we'll get you started within 24 hours.
                        </p>
                    </div>

                    {/* Form Container */}
                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Main Form */}
                        <div className="md:col-span-2">
                            <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-8">
                                {/* Contact Details Section */}
                                <div className="mb-8">
                                    <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                        <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                                            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                        </div>
                                        Contact Details
                                    </h2>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <InputField
                                            label="First Name"
                                            name="firstName"
                                            placeholder="John"
                                            required
                                            value={formData.firstName}
                                        />
                                        <InputField
                                            label="Last Name"
                                            name="lastName"
                                            placeholder="Smith"
                                            required
                                            value={formData.lastName}
                                        />
                                        <InputField
                                            label="Work Email"
                                            name="email"
                                            type="email"
                                            placeholder="john.smith@company.com"
                                            required
                                            value={formData.email}
                                        />
                                        <InputField
                                            label="Phone Number"
                                            name="phone"
                                            type="tel"
                                            placeholder="+44 20 1234 5678"
                                            value={formData.phone}
                                        />
                                        <div className="md:col-span-2">
                                            <InputField
                                                label="Job Title"
                                                name="jobTitle"
                                                placeholder="Head of Procurement"
                                                value={formData.jobTitle}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Company Details Section */}
                                <div className="mb-8">
                                    <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                            </svg>
                                        </div>
                                        Company Details
                                    </h2>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <InputField
                                            label="Company Name"
                                            name="companyName"
                                            placeholder="Acme Corporation"
                                            required
                                            value={formData.companyName}
                                        />
                                        <InputField
                                            label="Company Website"
                                            name="website"
                                            placeholder="www.company.com"
                                            value={formData.website}
                                        />
                                        <SelectField
                                            label="Company Size"
                                            name="companySize"
                                            options={companySizeOptions}
                                            required
                                            value={formData.companySize}
                                        />
                                        <SelectField
                                            label="Industry"
                                            name="industry"
                                            options={industryOptions}
                                            required
                                            value={formData.industry}
                                        />
                                    </div>
                                </div>

                                {/* Trial Details Section */}
                                <div className="mb-8">
                                    <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                        <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                                            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </div>
                                        Trial Details
                                    </h2>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <SelectField
                                            label="Typical Contract Value"
                                            name="contractValue"
                                            options={contractValueOptions}
                                            required
                                            value={formData.contractValue}
                                        />
                                        <SelectField
                                            label="When do you need this?"
                                            name="timeline"
                                            options={timelineOptions}
                                            value={formData.timeline}
                                        />
                                        <div className="md:col-span-2">
                                            <label htmlFor="useCase" className="block text-sm font-medium text-slate-700 mb-1">
                                                Describe your use case <span className="text-red-500">*</span>
                                            </label>
                                            <textarea
                                                id="useCase"
                                                name="useCase"
                                                value={formData.useCase}
                                                onChange={handleInputChange}
                                                rows={4}
                                                placeholder="Tell us about the contract negotiation you'd like to use CLARENCE for. What type of contract? What challenges are you facing?"
                                                className={`
                          w-full px-4 py-2.5 rounded-lg border transition-colors resize-none
                          ${errors.useCase
                                                        ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                                                        : 'border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
                                                    }
                          outline-none
                        `}
                                            />
                                            {errors.useCase && (
                                                <p className="mt-1 text-sm text-red-600">{errors.useCase}</p>
                                            )}
                                        </div>
                                        <div className="md:col-span-2">
                                            <SelectField
                                                label="How did you hear about CLARENCE?"
                                                name="hearAboutUs"
                                                options={hearAboutUsOptions}
                                                value={formData.hearAboutUs}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Consent & Submit */}
                                <div className="border-t border-slate-200 pt-6">
                                    {/* Marketing Consent */}
                                    <label className="flex items-start gap-3 mb-6 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            name="marketingConsent"
                                            checked={formData.marketingConsent}
                                            onChange={handleInputChange}
                                            className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 mt-0.5"
                                        />
                                        <span className="text-sm text-slate-600">
                                            I'd like to receive updates about CLARENCE features, tips, and news.
                                            You can unsubscribe at any time.
                                        </span>
                                    </label>

                                    {/* Submit Error */}
                                    {errors.submit && (
                                        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                                            <p className="text-sm text-red-600">{errors.submit}</p>
                                        </div>
                                    )}

                                    {/* Submit Button */}
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className={`
                      w-full py-3 font-semibold rounded-lg transition-all
                      ${isSubmitting
                                                ? 'bg-slate-400 cursor-not-allowed'
                                                : 'bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/25 hover:shadow-xl'
                                            }
                      text-white
                    `}
                                    >
                                        {isSubmitting ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                                </svg>
                                                Submitting...
                                            </span>
                                        ) : (
                                            'Request Free Trial'
                                        )}
                                    </button>

                                    {/* Privacy Note */}
                                    <p className="mt-4 text-xs text-slate-500 text-center">
                                        By submitting this form, you agree to our{' '}
                                        <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>
                                        {' '}and{' '}
                                        <Link href="/terms" className="text-blue-600 hover:underline">Terms of Service</Link>.
                                    </p>
                                </div>
                            </form>
                        </div>

                        {/* Sidebar */}
                        <div className="md:col-span-1">
                            {/* What's Included */}
                            <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
                                <h3 className="font-semibold text-slate-800 mb-4">What's Included</h3>
                                <ul className="space-y-3">
                                    <li className="flex items-start gap-3">
                                        <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <span className="text-sm text-slate-600">1 complete contract session</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <span className="text-sm text-slate-600">Up to 2 providers</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <span className="text-sm text-slate-600">Full 6-phase negotiation</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <span className="text-sm text-slate-600">50 CLARENCE AI interactions</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <span className="text-sm text-slate-600">Contract draft generation</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <div className="w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                            <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <span className="text-sm text-slate-600">Leverage calculation</span>
                                    </li>
                                </ul>
                            </div>

                            {/* Trust Signals */}
                            <div className="bg-slate-100 rounded-xl p-6 mb-6">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                                        <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-800 text-sm">Enterprise Security</p>
                                        <p className="text-xs text-slate-500">Your data is encrypted and secure</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                                        <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-800 text-sm">Quick Response</p>
                                        <p className="text-xs text-slate-500">We'll be in touch within 24 hours</p>
                                    </div>
                                </div>
                            </div>

                            {/* Questions */}
                            <div className="bg-white rounded-xl border border-slate-200 p-6">
                                <h3 className="font-semibold text-slate-800 mb-2">Have questions?</h3>
                                <p className="text-sm text-slate-600 mb-4">
                                    Our team is happy to help you understand if CLARENCE is right for you.
                                </p>
                                <Link
                                    href="/contact-sales"
                                    className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                                >
                                    Contact our team
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ================================================================== */}
            {/* SECTION 12: FOOTER */}
            {/* ================================================================== */}
            <footer className="bg-slate-900 text-slate-400 py-12 mt-12">
                <div className="container mx-auto px-6">
                    <div className="flex flex-col md:flex-row justify-between items-center">
                        {/* Brand */}
                        <div className="flex items-center gap-3 mb-6 md:mb-0">
                            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-sm">C</span>
                            </div>
                            <div>
                                <span className="text-white font-medium">CLARENCE</span>
                                <span className="text-slate-500 text-sm ml-2">The Honest Broker</span>
                            </div>
                        </div>

                        {/* Links */}
                        <div className="flex gap-8 text-sm">
                            <Link href="/" className="hover:text-white transition-colors">Home</Link>
                            <Link href="/how-it-works" className="hover:text-white transition-colors">How It Works</Link>
                            <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
                            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
                            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
                        </div>
                    </div>

                    <div className="border-t border-slate-800 mt-8 pt-8 text-center text-sm">
                        <p>&copy; {new Date().getFullYear()} CLARENCE. The Honest Broker.</p>
                    </div>
                </div>
            </footer>
        </div>
    )
}