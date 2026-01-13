'use client'
import { useState } from 'react'
import { Metadata } from 'next'
import Link from 'next/link'
import MainNavigation from '../components/MainNavigation'

// ============================================================================
// SECTION 1: REQUEST TRIAL PAGE
// Location: app/request-trial/page.tsx
// Purpose: Lead capture form for free trial requests
// ============================================================================

// Note: Metadata export needs to be in a separate file for client components
// export const metadata: Metadata = {
//   title: 'Request Free Trial | CLARENCE - AI-Powered Contract Mediation',
//   description: 'Start your free CLARENCE trial. Experience AI-powered contract mediation with transparent leverage and principled negotiation.',
// }

// ============================================================================
// SECTION 2: TYPE DEFINITIONS
// ============================================================================

interface FormData {
    firstName: string
    lastName: string
    email: string
    companyName: string
    companySize: string
    industry: string
    contractValue: string
    useCase: string
    howHeard: string
}

interface FormErrors {
    [key: string]: string
}

// ============================================================================
// SECTION 3: CONSTANTS
// ============================================================================

const COMPANY_SIZE_OPTIONS = [
    { value: '', label: 'Select company size' },
    { value: '1-10', label: '1-10 employees' },
    { value: '11-50', label: '11-50 employees' },
    { value: '51-200', label: '51-200 employees' },
    { value: '201-1000', label: '201-1,000 employees' },
    { value: '1001+', label: '1,000+ employees' },
]

const INDUSTRY_OPTIONS = [
    { value: '', label: 'Select industry' },
    { value: 'financial-services', label: 'Financial Services' },
    { value: 'technology', label: 'Technology' },
    { value: 'healthcare', label: 'Healthcare' },
    { value: 'professional-services', label: 'Professional Services' },
    { value: 'manufacturing', label: 'Manufacturing' },
    { value: 'retail', label: 'Retail' },
    { value: 'public-sector', label: 'Public Sector' },
    { value: 'other', label: 'Other' },
]

const CONTRACT_VALUE_OPTIONS = [
    { value: '', label: 'Select typical contract value' },
    { value: 'under-50k', label: 'Under £50,000' },
    { value: '50k-250k', label: '£50,000 - £250,000' },
    { value: '250k-1m', label: '£250,000 - £1 million' },
    { value: 'over-1m', label: 'Over £1 million' },
]

const HOW_HEARD_OPTIONS = [
    { value: '', label: 'How did you hear about us?' },
    { value: 'search', label: 'Search engine (Google, Bing, etc.)' },
    { value: 'linkedin', label: 'LinkedIn' },
    { value: 'referral', label: 'Referral from colleague' },
    { value: 'event', label: 'Event or conference' },
    { value: 'article', label: 'Article or blog post' },
    { value: 'other', label: 'Other' },
]

// ============================================================================
// SECTION 4: MAIN COMPONENT
// ============================================================================

export default function RequestTrialPage() {
    const [formData, setFormData] = useState<FormData>({
        firstName: '',
        lastName: '',
        email: '',
        companyName: '',
        companySize: '',
        industry: '',
        contractValue: '',
        useCase: '',
        howHeard: '',
    })

    const [errors, setErrors] = useState<FormErrors>({})
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isSubmitted, setIsSubmitted] = useState(false)

    // ========================================================================
    // SECTION 5: FORM HANDLERS
    // ========================================================================

    const handleInputChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }))
        }
    }

    const validateForm = (): boolean => {
        const newErrors: FormErrors = {}

        if (!formData.firstName.trim()) {
            newErrors.firstName = 'First name is required'
        }
        if (!formData.lastName.trim()) {
            newErrors.lastName = 'Last name is required'
        }
        if (!formData.email.trim()) {
            newErrors.email = 'Email is required'
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Please enter a valid email address'
        }
        if (!formData.companyName.trim()) {
            newErrors.companyName = 'Company name is required'
        }
        if (!formData.companySize) {
            newErrors.companySize = 'Please select company size'
        }
        if (!formData.industry) {
            newErrors.industry = 'Please select your industry'
        }

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!validateForm()) {
            return
        }

        setIsSubmitting(true)

        try {
            // TODO: Replace with actual API endpoint
            // const response = await fetch('/api/request-trial', {
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

    // ========================================================================
    // SECTION 6: SUCCESS STATE RENDER
    // ========================================================================

    if (isSubmitted) {
        return (
            <main className="min-h-screen bg-slate-50">
                <MainNavigation />

                <section className="py-20">
                    <div className="container mx-auto px-6">
                        <div className="max-w-lg mx-auto text-center">
                            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>

                            <h1 className="text-3xl font-bold text-slate-800 mb-4">
                                Thank You, {formData.firstName}!
                            </h1>

                            <p className="text-slate-600 mb-8">
                                We've received your trial request. Our team will review your application
                                and get back to you within 1-2 business days with your trial access details.
                            </p>

                            <div className="bg-white rounded-xl p-6 border border-slate-200 mb-8 text-left">
                                <h3 className="font-semibold text-slate-800 mb-4">What happens next?</h3>
                                <ul className="space-y-3 text-sm text-slate-600">
                                    <li className="flex items-start gap-3">
                                        <span className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 text-emerald-600 text-xs font-bold">1</span>
                                        <span>We'll review your request and verify your details</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 text-emerald-600 text-xs font-bold">2</span>
                                        <span>You'll receive an email with your trial account credentials</span>
                                    </li>
                                    <li className="flex items-start gap-3">
                                        <span className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 text-emerald-600 text-xs font-bold">3</span>
                                        <span>Start exploring the Training Studio and set up your first contract</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <Link
                                    href="/"
                                    className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg transition-colors"
                                >
                                    Return Home
                                </Link>
                                <Link
                                    href="/how-it-works"
                                    className="px-6 py-3 bg-white hover:bg-slate-50 text-slate-800 font-semibold rounded-lg border border-slate-300 transition-colors"
                                >
                                    Learn More
                                </Link>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        )
    }

    // ========================================================================
    // SECTION 7: FORM RENDER
    // ========================================================================

    return (
        <main className="min-h-screen bg-slate-50">
            <MainNavigation />

            <section className="py-16">
                <div className="container mx-auto px-6">
                    <div className="max-w-3xl mx-auto">
                        {/* Header */}
                        <div className="text-center mb-12">
                            <h1 className="text-3xl font-bold text-slate-800 mb-4">
                                Request Your Free Trial
                            </h1>
                            <p className="text-slate-600 max-w-xl mx-auto">
                                Experience AI-powered contract mediation with one complete contract session.
                                No credit card required.
                            </p>
                        </div>

                        {/* Form Card */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            {/* What's Included Banner */}
                            <div className="bg-emerald-50 border-b border-emerald-100 px-6 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
                                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-emerald-800">What's included in your trial</p>
                                        <p className="text-sm text-emerald-700">
                                            1 contract session • Up to 2 respondents • Full Training Studio access • Basic document package
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleSubmit} className="p-6 md:p-8">
                                {/* Contact Information */}
                                <div className="mb-8">
                                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Contact Information</h3>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        {/* First Name */}
                                        <div>
                                            <label htmlFor="firstName" className="block text-sm font-medium text-slate-700 mb-1">
                                                First Name <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                id="firstName"
                                                name="firstName"
                                                value={formData.firstName}
                                                onChange={handleInputChange}
                                                className={`w-full px-4 py-2.5 rounded-lg border ${errors.firstName ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-emerald-500'
                                                    } focus:ring-2 focus:border-transparent transition-colors`}
                                                placeholder="John"
                                            />
                                            {errors.firstName && (
                                                <p className="text-red-500 text-xs mt-1">{errors.firstName}</p>
                                            )}
                                        </div>

                                        {/* Last Name */}
                                        <div>
                                            <label htmlFor="lastName" className="block text-sm font-medium text-slate-700 mb-1">
                                                Last Name <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                id="lastName"
                                                name="lastName"
                                                value={formData.lastName}
                                                onChange={handleInputChange}
                                                className={`w-full px-4 py-2.5 rounded-lg border ${errors.lastName ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-emerald-500'
                                                    } focus:ring-2 focus:border-transparent transition-colors`}
                                                placeholder="Smith"
                                            />
                                            {errors.lastName && (
                                                <p className="text-red-500 text-xs mt-1">{errors.lastName}</p>
                                            )}
                                        </div>

                                        {/* Email - Full Width */}
                                        <div className="md:col-span-2">
                                            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                                                Work Email <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="email"
                                                id="email"
                                                name="email"
                                                value={formData.email}
                                                onChange={handleInputChange}
                                                className={`w-full px-4 py-2.5 rounded-lg border ${errors.email ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-emerald-500'
                                                    } focus:ring-2 focus:border-transparent transition-colors`}
                                                placeholder="john.smith@company.com"
                                            />
                                            {errors.email && (
                                                <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Company Information */}
                                <div className="mb-8">
                                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Company Information</h3>
                                    <div className="grid md:grid-cols-2 gap-4">
                                        {/* Company Name */}
                                        <div>
                                            <label htmlFor="companyName" className="block text-sm font-medium text-slate-700 mb-1">
                                                Company Name <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                id="companyName"
                                                name="companyName"
                                                value={formData.companyName}
                                                onChange={handleInputChange}
                                                className={`w-full px-4 py-2.5 rounded-lg border ${errors.companyName ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-emerald-500'
                                                    } focus:ring-2 focus:border-transparent transition-colors`}
                                                placeholder="Acme Corporation"
                                            />
                                            {errors.companyName && (
                                                <p className="text-red-500 text-xs mt-1">{errors.companyName}</p>
                                            )}
                                        </div>

                                        {/* Company Size */}
                                        <div>
                                            <label htmlFor="companySize" className="block text-sm font-medium text-slate-700 mb-1">
                                                Company Size <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                id="companySize"
                                                name="companySize"
                                                value={formData.companySize}
                                                onChange={handleInputChange}
                                                className={`w-full px-4 py-2.5 rounded-lg border ${errors.companySize ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-emerald-500'
                                                    } focus:ring-2 focus:border-transparent transition-colors bg-white`}
                                            >
                                                {COMPANY_SIZE_OPTIONS.map(option => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                            {errors.companySize && (
                                                <p className="text-red-500 text-xs mt-1">{errors.companySize}</p>
                                            )}
                                        </div>

                                        {/* Industry */}
                                        <div>
                                            <label htmlFor="industry" className="block text-sm font-medium text-slate-700 mb-1">
                                                Industry <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                id="industry"
                                                name="industry"
                                                value={formData.industry}
                                                onChange={handleInputChange}
                                                className={`w-full px-4 py-2.5 rounded-lg border ${errors.industry ? 'border-red-300 focus:ring-red-500' : 'border-slate-300 focus:ring-emerald-500'
                                                    } focus:ring-2 focus:border-transparent transition-colors bg-white`}
                                            >
                                                {INDUSTRY_OPTIONS.map(option => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                            {errors.industry && (
                                                <p className="text-red-500 text-xs mt-1">{errors.industry}</p>
                                            )}
                                        </div>

                                        {/* Contract Value */}
                                        <div>
                                            <label htmlFor="contractValue" className="block text-sm font-medium text-slate-700 mb-1">
                                                Typical Contract Value
                                            </label>
                                            <select
                                                id="contractValue"
                                                name="contractValue"
                                                value={formData.contractValue}
                                                onChange={handleInputChange}
                                                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors bg-white"
                                            >
                                                {CONTRACT_VALUE_OPTIONS.map(option => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Use Case */}
                                <div className="mb-8">
                                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Tell Us About Your Needs</h3>
                                    <div className="space-y-4">
                                        {/* Use Case Description */}
                                        <div>
                                            <label htmlFor="useCase" className="block text-sm font-medium text-slate-700 mb-1">
                                                What types of contracts are you looking to negotiate?
                                            </label>
                                            <textarea
                                                id="useCase"
                                                name="useCase"
                                                value={formData.useCase}
                                                onChange={handleInputChange}
                                                rows={3}
                                                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors resize-none"
                                                placeholder="e.g., BPO agreements, SaaS contracts, procurement negotiations..."
                                            />
                                        </div>

                                        {/* How Heard */}
                                        <div>
                                            <label htmlFor="howHeard" className="block text-sm font-medium text-slate-700 mb-1">
                                                How did you hear about CLARENCE?
                                            </label>
                                            <select
                                                id="howHeard"
                                                name="howHeard"
                                                value={formData.howHeard}
                                                onChange={handleInputChange}
                                                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors bg-white"
                                            >
                                                {HOW_HEARD_OPTIONS.map(option => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* Submit Error */}
                                {errors.submit && (
                                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                        {errors.submit}
                                    </div>
                                )}

                                {/* Submit Button */}
                                <div className="flex flex-col sm:flex-row gap-4">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="flex-1 px-8 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                Submitting...
                                            </>
                                        ) : (
                                            'Request Free Trial'
                                        )}
                                    </button>
                                    <Link
                                        href="/"
                                        className="px-8 py-3 bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-lg border border-slate-300 transition-colors text-center"
                                    >
                                        Cancel
                                    </Link>
                                </div>

                                {/* Privacy Note */}
                                <p className="text-xs text-slate-500 mt-4 text-center">
                                    By submitting this form, you agree to our{' '}
                                    <Link href="/privacy" className="text-emerald-600 hover:underline">Privacy Policy</Link>
                                    {' '}and{' '}
                                    <Link href="/terms" className="text-emerald-600 hover:underline">Terms of Service</Link>.
                                </p>
                            </form>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    )
}