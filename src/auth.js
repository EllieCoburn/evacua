import { supabase } from './supabase.js';

export class Auth {
  constructor(state) {
    this.state = state;
  }
  
  async signUp(email, password) {
    try {
      const result = await this.state.supabase.signUp(email, password);
      this.showToast(`Account created! Check ${email} for confirmation.`, 'success');
      return result;
    } catch (err) {
      this.showToast(`Sign up failed: ${err.message}`, 'error');
      throw err;
    }
  }
  
  async signIn(email, password) {
    try {
      const result = await this.state.supabase.signIn(email, password);
      this.showToast(`Welcome, ${email}!`, 'success');
      this.updateAuthUI();
      return result;
    } catch (err) {
      this.showToast(`Sign in failed: ${err.message}`, 'error');
      throw err;
    }
  }
  
  async signOut() {
    try {
      await this.state.supabase.signOut();
      this.showToast('Signed out', 'info');
      this.updateAuthUI();
    } catch (err) {
      this.showToast(`Sign out failed: ${err.message}`, 'error');
    }
  }
  
  async restoreSession() {
    const restored = await this.state.supabase.restoreSession();
    if (restored) {
      console.log('Session restored for', this.state.supabase.user.email);
      this.updateAuthUI();
      
      // Load user's plans
      this.loadUserPlans();
    }
    return restored;
  }
  
  async loadUserPlans() {
    if (!this.state.supabase?.user) return;
    
    try {
      const plans = await this.state.supabase.listPlans();
      this.state.userPlans = plans || [];
    } catch (err) {
      console.error('Failed to load plans:', err.message);
    }
  }
  
  showAuthModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'auth-modal';
    
    modal.innerHTML = `
      <div class="modal-box" style="max-width: 400px;">
        <div class="modal-head">
          <h1>Sign In to Evacua</h1>
        </div>
        <div class="modal-body">
          <form id="auth-form">
            <div class="form-group">
              <label>Email</label>
              <input type="email" id="auth-email" required placeholder="you@example.com">
            </div>
            <div class="form-group">
              <label>Password</label>
              <input type="password" id="auth-password" required placeholder="••••••••">
            </div>
            <button type="submit" class="btn btn-primary" style="width: 100%; margin-bottom: 8px;">
              Sign In
            </button>
            <button type="button" id="auth-signup-btn" class="btn" style="width: 100%;">
              Create Account
            </button>
          </form>
        </div>
      </div>
    `;
    
    document.getElementById('modal-host').appendChild(modal);
    
    const form = modal.querySelector('#auth-form');
    const emailInput = modal.querySelector('#auth-email');
    const passwordInput = modal.querySelector('#auth-password');
    const signupBtn = modal.querySelector('#auth-signup-btn');
    
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const email = emailInput.value;
      const password = passwordInput.value;
      
      try {
        await this.signIn(email, password);
        modal.remove();
      } catch (err) {
        // Error already shown via toast
      }
    });
    
    signupBtn.addEventListener('click', () => {
      const email = emailInput.value;
      const password = passwordInput.value;
      
      if (!email || !password) {
        this.showToast('Enter email and password', 'error');
        return;
      }
      
      this.showSignUpConfirm(email, password, modal);
    });
  }
  
  showSignUpConfirm(email, password, parentModal) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    modal.innerHTML = `
      <div class="modal-box" style="max-width: 400px;">
        <div class="modal-head">
          <h1>Create Account</h1>
        </div>
        <div class="modal-body">
          <p>Create account for <strong>${email}</strong>?</p>
          <p style="font-size: 12px; color: var(--c-fg-muted); margin-top: 12px;">
            You'll need to verify your email to use Evacua.
          </p>
        </div>
        <div class="modal-footer">
          <button class="btn" onclick="this.closest('.modal').remove()">Cancel</button>
          <button class="btn btn-primary" id="confirm-signup">Create</button>
        </div>
      </div>
    `;
    
    document.getElementById('modal-host').appendChild(modal);
    
    modal.querySelector('#confirm-signup').addEventListener('click', async () => {
      try {
        await this.signUp(email, password);
        modal.remove();
        parentModal.remove();
      } catch (err) {
        // Error shown via toast
      }
    });
  }
  
  updateAuthUI() {
    const user = this.state.supabase?.user;
    const authBtn = document.querySelector('[data-auth]');
    
    if (!authBtn) return;
    
    if (user) {
      authBtn.innerHTML = `<i data-ico="user"></i><span>${user.email}</span>`;
      authBtn.title = 'Click to sign out';
      authBtn.dataset.signedIn = 'true';
    } else {
      authBtn.innerHTML = '<i data-ico="login"></i><span>Sign In</span>';
      authBtn.title = 'Sign in to save plans to cloud';
      authBtn.dataset.signedIn = 'false';
    }
  }
  
  showToast(msg, type = 'info') {
    const host = document.getElementById('toast-host');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    host.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slide-in 200ms reverse ease-in';
      setTimeout(() => toast.remove(), 200);
    }, 3000);
  }
}
