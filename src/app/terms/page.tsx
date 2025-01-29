"use client";

import React from "react";

export default function TermsOfService() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-24">
      <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
      <div className="prose dark:prose-invert max-w-none">
        <p className="text-lg text-muted-foreground mb-8">
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
          <p>
            Welcome to Laignfy (&ldquo;Service&rdquo;), an AI-powered language learning platform. By accessing or using Laignfy, you agree to comply with and be bound by these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree with any part of these Terms, you must not access or use Laignfy.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">2. Service Description</h2>
          <p className="mb-4">
            Laignfy provides AI-powered language learning services, including but not limited to:
          </p>
          <ul className="list-disc pl-6 mb-4">
            <li>Interactive conversation practice with AI language tutors</li>
            <li>Real-time pronunciation feedback and speech recognition</li>
            <li>Visual learning through AI-generated images</li>
            <li>Personalized vocabulary and flashcard systems</li>
            <li>Progress tracking and performance analytics</li>
          </ul>
          <p>
            The Service utilizes various AI technologies, including OpenAI, to provide these features.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">3. User Eligibility and Accounts</h2>
          <p className="mb-4">To use Laignfy, you must:</p>
          <ul className="list-disc pl-6">
            <li>Be at least 13 years of age</li>
            <li>Provide accurate and complete registration information</li>
            <li>Maintain the security of your account credentials</li>
            <li>Accept responsibility for all activities under your account</li>
            <li>Notify us immediately of any unauthorized account access</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">4. User Conduct</h2>
          <p className="mb-4">When using Laignfy, you agree NOT to:</p>
          <ul className="list-disc pl-6">
            <li>Use the Service for any unlawful or prohibited purpose</li>
            <li>Harass, abuse, or harm other users</li>
            <li>Share inappropriate, offensive, or harmful content</li>
            <li>Attempt to interfere with or disrupt the Service</li>
            <li>Impersonate other users or entities</li>
            <li>Collect user data without authorization</li>
            <li>Use automated systems to access the Service</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">5. Content and Intellectual Property</h2>
          <p className="mb-4">
            All content provided through Laignfy, including AI-generated content, is protected by intellectual property rights. By using the Service:
          </p>
          <ul className="list-disc pl-6">
            <li>You retain rights to content you create or upload</li>
            <li>You grant us a license to use your content to provide the Service</li>
            <li>You acknowledge AI-generated content may have limitations</li>
            <li>You agree not to copy or distribute Service content without permission</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">6. Privacy and Data Usage</h2>
          <p>
            Your use of Laignfy is subject to our Privacy Policy. We collect and process data, including audio recordings and learning progress, to provide and improve the Service. See our Privacy Policy for details on data handling practices.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">7. Disclaimers</h2>
          <p className="mb-4">
            The Service is provided &ldquo;as is&rdquo; without warranties of any kind. Specifically:
          </p>
          <ul className="list-disc pl-6">
            <li>We do not guarantee language learning outcomes</li>
            <li>AI-generated content may contain inaccuracies</li>
            <li>Service availability may vary</li>
            <li>Audio processing may not be perfect</li>
            <li>Learning progress depends on user effort</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">8. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, Laignfy shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">9. Changes to Terms</h2>
          <p>
            We may modify these Terms at any time. Continued use of Laignfy after changes constitutes acceptance of the modified Terms. We will notify users of significant changes.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">10. Termination</h2>
          <p>
            We reserve the right to suspend or terminate your access to Laignfy for violations of these Terms or any other reason. You may terminate your account at any time by contacting us.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">11. Contact Information</h2>
          <p>
            For questions about these Terms, please contact us at:
          </p>
          <p className="mt-2">
            Email: terms@laignfy.com
          </p>
        </section>
      </div>
    </div>
  );
} 