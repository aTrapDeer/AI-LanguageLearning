"use client";

import React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { motion } from 'framer-motion';
import { VerticalCutReveal } from '@/components/ui/vertical-cut-reveal';
import AnimatedGlobe from '@/components/ui/globe';
import { BackgroundGradientAnimation } from '@/components/ui/background-gradient-animation';
import { MessageCircle, Mic, Brain, Image as ImageIcon, Sparkles, Globe2, ArrowRight, Zap, Target } from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15,
    },
  },
};

export default function Home() {
  const { data: session } = useSession();

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 selection:bg-indigo-500/30">
      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden min-h-[90vh] flex items-center">
        <BackgroundGradientAnimation
          gradientBackgroundStart="rgb(15, 23, 42)"
          gradientBackgroundEnd="rgb(30, 27, 75)"
          firstColor="99, 102, 241"
          secondColor="168, 85, 247"
          thirdColor="236, 72, 153"
          fourthColor="56, 189, 248"
          fifthColor="250, 204, 21"
          pointerColor="140, 100, 255"
          size="80%"
          blendingValue="hard-light"
          containerClassName="absolute inset-0"
        />
        <div className="absolute inset-0 opacity-50 mix-blend-overlay pointer-events-none">
          <AnimatedGlobe />
        </div>
        
        <div className="container relative mx-auto px-4 z-10">
          <div className="text-center max-w-4xl mx-auto space-y-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-sm font-medium mb-4"
            >
              <Sparkles className="w-4 h-4 text-yellow-300" />
              <span>The future of language learning is here</span>
            </motion.div>

            <div className="flex flex-col items-center justify-center space-y-6">
              <VerticalCutReveal
                splitBy="characters"
                staggerDuration={0.05}
                staggerFrom="center"
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 20,
                }}
                containerClassName="text-7xl md:text-8xl lg:text-9xl font-black tracking-tighter text-center flex justify-center drop-shadow-2xl"
                elementLevelClassName="text-white hover:scale-110 hover:text-indigo-300 transition-all duration-300 cursor-default"
              >
                LAINGFY
              </VerticalCutReveal>
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.8 }}
                className="text-xl md:text-2xl text-white/90 font-medium max-w-2xl leading-relaxed"
              >
                Master any language naturally through immersive AI conversations, personalized journeys, and real-time feedback.
              </motion.p>
            </div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="flex flex-col sm:flex-row justify-center gap-4 pt-8"
            >
              {session ? (
                <>
                  <Link
                    href="/dashboard"
                    className="group relative px-8 py-4 bg-white text-indigo-950 rounded-full font-bold text-lg hover:scale-105 transition-all shadow-[0_0_40px_rgba(255,255,255,0.3)] flex items-center gap-2"
                  >
                    Go to Dashboard
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/register"
                    className="group relative px-8 py-4 bg-white text-indigo-950 rounded-full font-bold text-lg hover:scale-105 transition-all shadow-[0_0_40px_rgba(255,255,255,0.3)] flex items-center gap-2"
                  >
                    Start Learning Free
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link
                    href="/login"
                    className="px-8 py-4 bg-white/10 backdrop-blur-md border border-white/20 text-white rounded-full font-bold text-lg hover:bg-white/20 transition-all"
                  >
                    Log In
                  </Link>
                </>
              )}
            </motion.div>
          </div>
        </div>
        
        {/* Decorative bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-50 dark:from-slate-950 to-transparent z-10" />
      </section>

      {/* Features Bento Grid */}
      <section className="py-24 relative z-20">
        <div className="container mx-auto px-4">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={containerVariants}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-extrabold mb-6 text-slate-900 dark:text-white tracking-tight">
              Supercharge your fluency with{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
                AI Magic
              </span>
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              Traditional apps teach you to memorize. Laingfy teaches you to speak, think, and connect in your new language.
            </p>
          </motion.div>

          <motion.div 
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto"
          >
            {/* Large Feature Card */}
            <motion.div variants={itemVariants} className="md:col-span-2 group relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 shadow-xl shadow-indigo-100/20 dark:shadow-none hover:border-indigo-500/50 transition-colors">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity group-hover:scale-110 duration-500">
                <MessageCircle className="w-48 h-48 text-indigo-500" />
              </div>
              <div className="relative z-10">
                <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-6 text-indigo-600 dark:text-indigo-400">
                  <MessageCircle className="w-7 h-7" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">Real-time AI Conversations</h3>
                <p className="text-slate-600 dark:text-slate-400 text-lg max-w-md">
                  Stop talking to yourself. Engage in dynamic, voice-based conversations with AI personas that adapt to your skill level, correct your mistakes gently, and keep the chat flowing naturally.
                </p>
              </div>
            </motion.div>

            {/* Small Feature Card */}
            <motion.div variants={itemVariants} className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-500 to-indigo-600 p-8 text-white shadow-xl hover:shadow-2xl transition-shadow">
              <div className="absolute -right-4 -bottom-4 opacity-20 group-hover:scale-110 transition-transform duration-500">
                <Mic className="w-32 h-32" />
              </div>
              <div className="relative z-10">
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-sm">
                  <Mic className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-4">Perfect Pronunciation</h3>
                <p className="text-white/80">
                  Advanced speech recognition listens to your accent and provides instant, actionable feedback to sound like a native.
                </p>
              </div>
            </motion.div>

            {/* Small Feature Card */}
            <motion.div variants={itemVariants} className="group relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 shadow-sm hover:border-pink-500/50 transition-colors">
              <div className="w-14 h-14 bg-pink-100 dark:bg-pink-500/20 rounded-2xl flex items-center justify-center mb-6 text-pink-600 dark:text-pink-400">
                <Target className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">Personalized Journeys</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Whether you're traveling to Tokyo or closing a deal in Berlin, our AI generates custom learning paths tailored to your exact goals.
              </p>
            </motion.div>

            {/* Small Feature Card */}
            <motion.div variants={itemVariants} className="group relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 shadow-sm hover:border-emerald-500/50 transition-colors">
              <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-6 text-emerald-600 dark:text-emerald-400">
                <Brain className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">Smart Reinforcement</h3>
              <p className="text-slate-600 dark:text-slate-400">
                Never forget a word again. Our spaced repetition system identifies your weak spots and seamlessly weaves them into your next lesson.
              </p>
            </motion.div>

            {/* Medium Feature Card */}
            <motion.div variants={itemVariants} className="group relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 shadow-sm hover:border-amber-500/50 transition-colors">
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity group-hover:scale-110 duration-500">
                <ImageIcon className="w-40 h-40 text-amber-500" />
              </div>
              <div className="relative z-10">
                <div className="w-14 h-14 bg-amber-100 dark:bg-amber-500/20 rounded-2xl flex items-center justify-center mb-6 text-amber-600 dark:text-amber-400">
                  <ImageIcon className="w-7 h-7" />
                </div>
                <h3 className="text-2xl font-bold mb-4 text-slate-900 dark:text-white">Visual Context Learning</h3>
                <p className="text-slate-600 dark:text-slate-400">
                  Describe AI-generated scenes in your target language. Connect words to images, not just translations, for faster fluency.
                </p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Languages Section */}
      <section className="py-24 bg-slate-100 dark:bg-slate-900/50 relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-64 bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />
        
        <div className="container mx-auto px-4 relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-slate-900 dark:text-white">
              Choose Your Next Adventure
            </h2>
            <p className="text-slate-600 dark:text-slate-400">Immerse yourself in cultures from around the world.</p>
          </motion.div>

          <motion.div 
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 max-w-6xl mx-auto"
          >
            {[
              { code: 'de', flag: '🇩🇪', name: 'German', color: 'hover:bg-amber-50 dark:hover:bg-amber-500/10 hover:border-amber-200 dark:hover:border-amber-500/30' },
              { code: 'pt-BR', flag: '🇧🇷', name: 'Portuguese', color: 'hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:border-emerald-200 dark:hover:border-emerald-500/30' },
              { code: 'zh', flag: '🇨🇳', name: 'Chinese', color: 'hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-200 dark:hover:border-red-500/30' },
              { code: 'no', flag: '🇳🇴', name: 'Norwegian', color: 'hover:bg-blue-50 dark:hover:bg-blue-500/10 hover:border-blue-200 dark:hover:border-blue-500/30' },
              { code: 'ko', flag: '🇰🇷', name: 'Korean', color: 'hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:border-indigo-200 dark:hover:border-indigo-500/30' },
              { code: 'ar', flag: '🇸🇦', name: 'Arabic', color: 'hover:bg-green-50 dark:hover:bg-green-500/10 hover:border-green-200 dark:hover:border-green-500/30' },
            ].map((lang) => (
              <motion.div key={lang.code} variants={itemVariants}>
                <Link 
                  href={`/learn/${lang.code}`} 
                  className={`flex flex-col items-center justify-center p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300 group ${lang.color}`}
                >
                  <span className="text-5xl mb-4 transform group-hover:scale-125 group-hover:-rotate-6 transition-transform duration-300 drop-shadow-md block">
                    {lang.flag}
                  </span>
                  <h3 className="font-semibold text-slate-700 dark:text-slate-300">{lang.name}</h3>
                </Link>
              </motion.div>
            ))}
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 }}
            className="mt-12 text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-sm font-medium">
              <Globe2 className="w-4 h-4" />
              <span>More languages added regularly</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-indigo-600 dark:bg-indigo-900" />
        <div className="absolute inset-0 bg-[url('/noise.png')] opacity-20 mix-blend-overlay" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-pink-500/30 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/30 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="container mx-auto px-4 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto"
          >
            <Zap className="w-16 h-16 text-yellow-300 mx-auto mb-8 drop-shadow-lg" />
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Ready to speak like a local?
            </h2>
            <p className="text-xl text-indigo-100 mb-10">
              Join thousands of learners who are mastering new languages with the power of AI.
            </p>
            <Link
              href={session ? "/dashboard" : "/register"}
              className="inline-flex items-center gap-2 px-10 py-5 bg-white text-indigo-600 rounded-full font-bold text-xl hover:scale-105 transition-all shadow-xl hover:shadow-2xl hover:shadow-white/20"
            >
              {session ? "Continue Your Journey" : "Start Learning Now"}
              <ArrowRight className="w-6 h-6" />
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
