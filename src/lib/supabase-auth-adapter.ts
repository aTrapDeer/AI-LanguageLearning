import { supabase, supabaseAdmin } from './supabase';
import type { Adapter, AdapterAccount, AdapterSession, AdapterUser, VerificationToken } from 'next-auth/adapters';

// Use admin client when available, otherwise fallback to regular client
const adminClient = supabaseAdmin || supabase;

export function SupabaseAdapter(): Adapter {
  return {
    async createUser(user: Omit<AdapterUser, "id">): Promise<AdapterUser> {
      const { data, error } = await adminClient
        .from('users')
        .insert([
          {
            name: user.name,
            email: user.email,
            email_verified: user.emailVerified?.toISOString() || null,
            image: user.image,
            password: '', // OAuth users won't have a password
            native_language: 'English', // Default
            active_language: 'en',
            learning_languages: [],
            account_setup: false // Add accountSetup field
          }
        ])
        .select()
        .single();

      if (error) throw error;
      return {
        id: data.id,
        name: data.name,
        email: data.email,
        emailVerified: data.email_verified ? new Date(data.email_verified) : null,
        image: data.image,
        learningLanguages: data.learning_languages || [],
        accountSetup: data.account_setup
      };
    },

    async getUser(id: string): Promise<AdapterUser | null> {
      const { data, error } = await adminClient
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }
      
      if (!data) return null;
      
      return {
        id: data.id,
        name: data.name,
        email: data.email,
        emailVerified: data.email_verified ? new Date(data.email_verified) : null,
        image: data.image,
        learningLanguages: data.learning_languages || [],
        accountSetup: data.account_setup
      };
    },

    async getUserByEmail(email: string): Promise<AdapterUser | null> {
      const { data, error } = await adminClient
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }
      
      if (!data) return null;
      
      return {
        id: data.id,
        name: data.name,
        email: data.email,
        emailVerified: data.email_verified ? new Date(data.email_verified) : null,
        image: data.image,
        learningLanguages: data.learning_languages || [],
        accountSetup: data.account_setup
      };
    },

    async getUserByAccount({ providerAccountId, provider }: { providerAccountId: string, provider: string }): Promise<AdapterUser | null> {
      // First get the account
      const { data: accountData, error: accountError } = await adminClient
        .from('accounts')
        .select('user_id')
        .eq('provider', provider)
        .eq('provider_account_id', providerAccountId)
        .single();

      if (accountError) {
        if (accountError.code === 'PGRST116') return null; // Not found
        throw accountError;
      }

      if (!accountData) return null;

      // Then get the user
      const { data: userData, error: userError } = await adminClient
        .from('users')
        .select('*')
        .eq('id', accountData.user_id)
        .single();

      if (userError) {
        if (userError.code === 'PGRST116') return null; // Not found
        throw userError;
      }
      
      if (!userData) return null;
      
      return {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        emailVerified: userData.email_verified ? new Date(userData.email_verified) : null,
        image: userData.image,
        learningLanguages: userData.learning_languages || [],
        accountSetup: userData.account_setup
      };
    },

    async updateUser(user: Partial<AdapterUser> & { id: string }): Promise<AdapterUser> {
      const { data, error } = await adminClient
        .from('users')
        .update({
          name: user.name,
          email: user.email,
          email_verified: user.emailVerified?.toISOString() || null,
          image: user.image
        })
        .eq('id', user.id)
        .select()
        .single();

      if (error) throw error;
      
      return {
        id: data.id,
        name: data.name,
        email: data.email,
        emailVerified: data.email_verified ? new Date(data.email_verified) : null,
        image: data.image,
        learningLanguages: data.learning_languages || [],
        accountSetup: data.account_setup
      };
    },

    async linkAccount(account: AdapterAccount): Promise<AdapterAccount> {
      // Store the account in Supabase
      const { error } = await adminClient
        .from('accounts')
        .insert([
          {
            user_id: account.userId,
            type: account.type,
            provider: account.provider,
            provider_account_id: account.providerAccountId,
            refresh_token: account.refresh_token,
            access_token: account.access_token,
            expires_at: account.expires_at,
            token_type: account.token_type,
            scope: account.scope,
            id_token: account.id_token,
            session_state: account.session_state
          }
        ]);

      if (error) throw error;
      return account;
    },

    async createSession(session: { sessionToken: string; userId: string; expires: Date }): Promise<AdapterSession> {
      const { error } = await adminClient
        .from('sessions')
        .insert([
          {
            user_id: session.userId,
            expires: session.expires.toISOString(),
            session_token: session.sessionToken
          }
        ]);

      if (error) throw error;
      return session;
    },

    async getSessionAndUser(sessionToken: string): Promise<{ session: AdapterSession; user: AdapterUser } | null> {
      // Get the session
      const { data: sessionData, error: sessionError } = await adminClient
        .from('sessions')
        .select('*')
        .eq('session_token', sessionToken)
        .single();

      if (sessionError) {
        if (sessionError.code === 'PGRST116') return null; // Not found
        throw sessionError;
      }

      if (!sessionData) return null;

      // Get the user
      const { data: userData, error: userError } = await adminClient
        .from('users')
        .select('*')
        .eq('id', sessionData.user_id)
        .single();

      if (userError) {
        if (userError.code === 'PGRST116') return null; // Not found
        throw userError;
      }

      if (!userData) return null;

      const user: AdapterUser = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        emailVerified: userData.email_verified ? new Date(userData.email_verified) : null,
        image: userData.image,
        learningLanguages: userData.learning_languages || [],
        accountSetup: userData.account_setup
      };

      const session: AdapterSession = {
        sessionToken: sessionData.session_token,
        userId: sessionData.user_id,
        expires: new Date(sessionData.expires)
      };

      return { user, session };
    },

    async updateSession(session: Partial<AdapterSession> & Pick<AdapterSession, "sessionToken">): Promise<AdapterSession | null> {
      // Make sure session has an expires field
      if (!session.expires) {
        return null;
      }

      const { data, error } = await adminClient
        .from('sessions')
        .update({
          expires: session.expires.toISOString()
        })
        .eq('session_token', session.sessionToken)
        .select()
        .single();

      if (error) throw error;
      
      if (!data) return null;
      
      return {
        sessionToken: data.session_token,
        userId: data.user_id,
        expires: new Date(data.expires)
      };
    },

    async deleteSession(sessionToken: string) {
      const { error } = await adminClient
        .from('sessions')
        .delete()
        .eq('session_token', sessionToken);

      if (error) throw error;
    },

    async createVerificationToken(token: VerificationToken): Promise<VerificationToken> {
      const { error } = await adminClient
        .from('verification_tokens')
        .insert([
          {
            identifier: token.identifier,
            token: token.token,
            expires: token.expires.toISOString()
          }
        ]);

      if (error) throw error;
      return token;
    },

    async useVerificationToken({ identifier, token }: { identifier: string, token: string }): Promise<VerificationToken | null> {
      // Get the token
      const { data, error } = await adminClient
        .from('verification_tokens')
        .select('*')
        .eq('identifier', identifier)
        .eq('token', token)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      if (!data) return null;

      // Delete the token
      const { error: deleteError } = await adminClient
        .from('verification_tokens')
        .delete()
        .eq('identifier', identifier)
        .eq('token', token);

      if (deleteError) throw deleteError;

      return {
        identifier: data.identifier,
        token: data.token,
        expires: new Date(data.expires)
      };
    },

    async deleteUser(userId: string) {
      const { error } = await adminClient
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) throw error;
    },

    async unlinkAccount({ providerAccountId, provider }: { providerAccountId: string, provider: string }) {
      const { error } = await adminClient
        .from('accounts')
        .delete()
        .eq('provider', provider)
        .eq('provider_account_id', providerAccountId);

      if (error) throw error;
    }
  };
} 