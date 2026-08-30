import { config, validateConfig } from './config.js';

export class SupabaseClient {
  constructor(url, anonKey) {
    this.url = url;
    this.anonKey = anonKey;
    this.session = null;
    this.user = null;
  }
  
  async auth(method, data) {
    const endpoint = `${this.url}/auth/v1/${method}`;
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.anonKey,
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Auth error');
    }
    
    return await response.json();
  }
  
  async signUp(email, password) {
    const result = await this.auth('signup', { email, password });
    this.session = result.session;
    this.user = result.user;
    localStorage.setItem('evacua_session', JSON.stringify(result.session));
    return result;
  }
  
  async signIn(email, password) {
    const result = await this.auth('token?grant_type=password', { email, password });
    this.session = result;
    
    // Decode JWT to get user info
    const payload = JSON.parse(atob(result.access_token.split('.')[1]));
    this.user = { id: payload.sub, email: payload.email };
    
    localStorage.setItem('evacua_session', JSON.stringify(result));
    return result;
  }
  
  async signOut() {
    if (this.session?.access_token) {
      try {
        await fetch(`${this.url}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.session.access_token}`,
            'apikey': this.anonKey,
          },
        });
      } catch (e) {
        // Logout can fail but we still clear local state
      }
    }
    this.session = null;
    this.user = null;
    localStorage.removeItem('evacua_session');
  }
  
  async restoreSession() {
    const saved = localStorage.getItem('evacua_session');
    if (saved) {
      try {
        const session = JSON.parse(saved);
        const payload = JSON.parse(atob(session.access_token.split('.')[1]));
        
        if (payload.exp * 1000 > Date.now()) {
          this.session = session;
          this.user = { id: payload.sub, email: payload.email };
          return true;
        }
      } catch (e) {
        localStorage.removeItem('evacua_session');
      }
    }
    return false;
  }
  
  async query(table, method = 'GET', data = null, filters = {}) {
    if (!this.session?.access_token) {
      throw new Error('Not authenticated');
    }
    
    let url = `${this.url}/rest/v1/${table}`;
    
    if (method === 'GET' && Object.keys(filters).length > 0) {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        params.append(key, value);
      });
      if (params.toString()) url += `?${params}`;
    }
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.session.access_token}`,
        'apikey': this.anonKey,
        'Prefer': 'return=representation',
      },
    };
    
    if (data) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const text = await response.text();
      let err;
      try {
        err = JSON.parse(text);
      } catch {
        err = { message: text };
      }
      throw new Error(err.message || `Error: ${response.status}`);
    }
    
    if (response.status === 204) {
      return null;
    }
    
    return await response.json();
  }
  
  async savePlan(plan) {
    if (!this.user) {
      throw new Error('Must be logged in');
    }
    
    const data = {
      user_id: this.user.id,
      name: plan.name,
      location: plan.location,
      description: plan.description,
      plan_data: JSON.stringify({
        objects: plan.objects.map(obj => obj.toJSON()),
      }),
      updated_at: new Date().toISOString(),
    };
    
    try {
      if (plan.db_id) {
        await this.query('plans', 'PATCH', data, { id: `eq.${plan.db_id}` });
        return { db_id: plan.db_id };
      } else {
        const result = await this.query('plans', 'POST', data);
        return result?.[0] || { success: true };
      }
    } catch (err) {
      throw err;
    }
  }
  
  async loadPlan(planId) {
    const result = await this.query('plans', 'GET', null, { id: `eq.${planId}` });
    return result?.[0] || null;
  }
  
  async listPlans() {
    if (!this.user) {
      return [];
    }
    
    try {
      return await this.query('plans', 'GET', null, { user_id: `eq.${this.user.id}` });
    } catch (err) {
      return [];
    }
  }
  
  async deletePlan(planId) {
    await this.query('plans', 'DELETE', null, { id: `eq.${planId}` });
  }
  
  async sharePlan(planId, email) {
    await this.query('plan_shares', 'POST', {
      plan_id: planId,
      shared_with_email: email,
    });
  }
}

// Create singleton with validated config
export let supabase;

export async function initSupabase() {
  try {
    validateConfig();
    supabase = new SupabaseClient(config.supabase.url, config.supabase.anonKey);
  } catch (err) {
    console.error('Supabase config error:', err.message);
    supabase = null;
  }
  return supabase;
}
