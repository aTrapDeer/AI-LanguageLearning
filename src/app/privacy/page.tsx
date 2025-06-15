"use client";

import React from "react";

export default function PrivacyPolicy() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-24">
      <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
      <div className="prose dark:prose-invert max-w-none">
        <p className="text-lg text-muted-foreground mb-8">
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Introduction</h2>
          <p>
            Laignfy (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our language learning platform.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Information We Collect</h2>
          <h3 className="text-xl font-medium mb-2">Personal Information</h3>
          <ul className="list-disc pl-6 mb-4">
            <li>Email address and name (for account creation)</li>
            <li>Language learning preferences and settings</li>
            <li>Progress data and learning history</li>
          </ul>

          <h3 className="text-xl font-medium mb-2">Audio Data</h3>
          <ul className="list-disc pl-6 mb-4">
            <li>Voice recordings during conversation practice sessions</li>
            <li>Speech-to-text transcriptions</li>
            <li>Microphone settings and preferences</li>
          </ul>

          <h3 className="text-xl font-medium mb-2">Usage Data</h3>
          <ul className="list-disc pl-6">
            <li>Learning session duration and frequency</li>
            <li>Feature usage patterns</li>
            <li>Performance metrics and progress statistics</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">How We Use Your Information</h2>
          <ul className="list-disc pl-6">
            <li>To provide personalized language learning experiences</li>
            <li>To process and analyze speech for real-time feedback</li>
            <li>To track and display your learning progress</li>
            <li>To improve our AI language tutoring capabilities</li>
            <li>To maintain and enhance our platform&apos;s features</li>
            <li>To communicate with you about your account and updates</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Data Storage and Security</h2>
          <p className="mb-4">
            We implement appropriate technical and organizational measures to protect your personal information, including:
          </p>
          <ul className="list-disc pl-6">
            <li>Encryption of data in transit and at rest</li>
            <li>Secure processing of audio data</li>
            <li>Regular security assessments and updates</li>
            <li>Limited employee access to personal information</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Third-Party Services</h2>
          <p className="mb-4">
            We use the following third-party services to power our platform:
          </p>
          <ul className="list-disc pl-6">
            <li>OpenAI for language processing and conversation generation</li>
            <li>OpenAI for real-time audio processing</li>
            <li>Authentication providers for secure account access</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Your Rights</h2>
          <p className="mb-4">You have the right to:</p>
          <ul className="list-disc pl-6">
            <li>Access your personal information</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Export your learning history</li>
            <li>Opt-out of non-essential data collection</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy or our data practices, please contact us at:
          </p>
          <p className="mt-2">
            Email: privacy@laingfy.com
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the &ldquo;Last updated&rdquo; date.
          </p>
        </section>
      </div>
    </div>
  );
} 