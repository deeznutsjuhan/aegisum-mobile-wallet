// Admin Dashboard JavaScript

let authToken = localStorage.getItem('adminToken');
let currentSection = 'dashboard-stats';

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    if (authToken) {
        showDashboard();
        loadDashboardStats();
    } else {
        showLoginModal();
    }
});

// Show login modal
function showLoginModal() {
    // Wait for Bootstrap to load
    if (typeof bootstrap === 'undefined') {
        setTimeout(showLoginModal, 100);
        return;
    }
    const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
    loginModal.show();
}

// Handle login form submission
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const twoFactorCode = document.getElementById('twoFactorCode').value;
    
    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username,
                password,
                twoFactorCode: twoFactorCode || undefined
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            authToken = data.data.token;
            localStorage.setItem('adminToken', authToken);
            document.getElementById('adminUsername').textContent = data.data.username;
            
            if (typeof bootstrap !== 'undefined') {
                bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
            }
            showDashboard();
            loadDashboardStats();
            showToast('Login successful', 'success');
        } else {
            if (data.message.includes('2FA')) {
                document.getElementById('twoFactorGroup').style.display = 'block';
                document.getElementById('twoFactorCode').focus();
            }
            showToast(data.message, 'error');
        }
    } catch (error) {
        showToast('Login failed: ' + error.message, 'error');
    }
});

// Show dashboard
function showDashboard() {
    document.getElementById('dashboard').style.display = 'block';
}

// Logout
function logout() {
    localStorage.removeItem('adminToken');
    authToken = null;
    document.getElementById('dashboard').style.display = 'none';
    showLoginModal();
    showToast('Logged out successfully', 'info');
}

// Show section
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Remove active class from all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Show selected section
    document.getElementById(sectionId).style.display = 'block';
    
    // Add active class to clicked nav link
    event.target.classList.add('active');
    
    currentSection = sectionId;
    
    // Load section data
    switch(sectionId) {
        case 'dashboard-stats':
            loadDashboardStats();
            break;
        case 'users':
            loadUsers();
            break;
        case 'blocked-entities':
            loadBlockedEntities();
            break;
        case 'transactions':
            loadTransactions();
            break;
        case 'fee-settings':
            loadFeeSettings();
            break;
        case 'suspicious-activity':
            loadSuspiciousActivity();
            break;
    }
}

// API request helper
async function apiRequest(endpoint, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        }
    };
    
    const response = await fetch(endpoint, { ...defaultOptions, ...options });
    const data = await response.json();
    
    if (!response.ok) {
        if (response.status === 401) {
            logout();
            throw new Error('Session expired');
        }
        throw new Error(data.message || 'Request failed');
    }
    
    return data;
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        const data = await apiRequest('/api/admin/dashboard/stats');
        const stats = data.data;
        
        // Update stat cards
        document.getElementById('totalUsers').textContent = stats.users.total_users;
        document.getElementById('totalWallets').textContent = stats.wallets.total_wallets;
        document.getElementById('totalTransactions').textContent = stats.transactions.total_transactions;
        document.getElementById('blockedEntities').textContent = stats.blocked.total_blocked;
        
        // Load recent activity
        loadRecentUsers();
        loadRecentTransactions();
        
    } catch (error) {
        showToast('Failed to load dashboard stats: ' + error.message, 'error');
    }
}

// Load recent users
async function loadRecentUsers() {
    try {
        const data = await apiRequest('/api/admin/users?limit=5');
        const users = data.data.users;
        
        let html = '';
        if (users.length === 0) {
            html = '<p class="text-muted">No users found</p>';
        } else {
            users.forEach(user => {
                const status = user.is_blocked ? 'blocked' : 'active';
                const statusClass = user.is_blocked ? 'status-blocked' : 'status-active';
                
                html += `
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <div>
                            <strong>${escapeHtml(user.username)}</strong><br>
                            <small class="text-muted">${escapeHtml(user.email)}</small>
                        </div>
                        <span class="badge ${statusClass}">${status}</span>
                    </div>
                `;
            });
        }
        
        document.getElementById('recentUsers').innerHTML = html;
    } catch (error) {
        document.getElementById('recentUsers').innerHTML = '<p class="text-danger">Failed to load users</p>';
    }
}

// Load recent transactions
async function loadRecentTransactions() {
    try {
        const data = await apiRequest('/api/admin/transactions?limit=5');
        const transactions = data.data.transactions;
        
        let html = '';
        if (transactions.length === 0) {
            html = '<p class="text-muted">No transactions found</p>';
        } else {
            transactions.forEach(tx => {
                const statusClass = `status-${tx.status}`;
                
                html += `
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <div>
                            <strong>${tx.amount} AEGS</strong><br>
                            <small class="text-muted">${escapeHtml(tx.username || 'Unknown')}</small>
                        </div>
                        <span class="badge ${statusClass}">${tx.status}</span>
                    </div>
                `;
            });
        }
        
        document.getElementById('recentTransactions').innerHTML = html;
    } catch (error) {
        document.getElementById('recentTransactions').innerHTML = '<p class="text-danger">Failed to load transactions</p>';
    }
}

// Load users
async function loadUsers(search = '') {
    try {
        const endpoint = search ? `/api/admin/users?search=${encodeURIComponent(search)}` : '/api/admin/users';
        const data = await apiRequest(endpoint);
        const users = data.data.users;
        
        let html = `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>Username</th>
                            <th>Email</th>
                            <th>Status</th>
                            <th>Created</th>
                            <th>Last Login</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        if (users.length === 0) {
            html += '<tr><td colspan="6" class="text-center text-muted">No users found</td></tr>';
        } else {
            users.forEach(user => {
                const status = user.is_blocked ? 'blocked' : 'active';
                const statusClass = user.is_blocked ? 'status-blocked' : 'status-active';
                const lastLogin = user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never';
                
                html += `
                    <tr>
                        <td>${escapeHtml(user.username)}</td>
                        <td>${escapeHtml(user.email)}</td>
                        <td><span class="badge ${statusClass}">${status}</span></td>
                        <td>${new Date(user.created_at).toLocaleDateString()}</td>
                        <td>${lastLogin}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary me-1" onclick="viewUserDetails(${user.id})">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-sm ${user.is_blocked ? 'btn-outline-success' : 'btn-outline-danger'}" 
                                    onclick="toggleUserBlock(${user.id}, '${user.is_blocked ? 'unblock' : 'block'}')">
                                <i class="fas fa-${user.is_blocked ? 'unlock' : 'ban'}"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
        }
        
        html += '</tbody></table></div>';
        document.getElementById('usersTable').innerHTML = html;
        
    } catch (error) {
        document.getElementById('usersTable').innerHTML = '<p class="text-danger">Failed to load users: ' + error.message + '</p>';
    }
}

// Search users
function searchUsers() {
    const search = document.getElementById('userSearch').value;
    loadUsers(search);
}

// Toggle user block status
async function toggleUserBlock(userId, action) {
    const reason = action === 'block' ? prompt('Enter reason for blocking (optional):') : null;
    if (action === 'block' && reason === null) return; // User cancelled
    
    try {
        await apiRequest(`/api/admin/users/${userId}/toggle-block`, {
            method: 'POST',
            body: JSON.stringify({ action, reason })
        });
        
        showToast(`User ${action}ed successfully`, 'success');
        loadUsers();
    } catch (error) {
        showToast(`Failed to ${action} user: ` + error.message, 'error');
    }
}

// Load blocked entities
async function loadBlockedEntities() {
    try {
        const data = await apiRequest('/api/admin/blocked');
        const entities = data.data.entities;
        
        let html = `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>Value</th>
                            <th>Reason</th>
                            <th>Blocked By</th>
                            <th>Date</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        if (entities.length === 0) {
            html += '<tr><td colspan="6" class="text-center text-muted">No blocked entities found</td></tr>';
        } else {
            entities.forEach(entity => {
                html += `
                    <tr>
                        <td><span class="badge bg-secondary">${entity.type}</span></td>
                        <td class="text-truncate-custom">${escapeHtml(entity.value)}</td>
                        <td class="text-truncate-custom">${escapeHtml(entity.reason || 'No reason provided')}</td>
                        <td>${escapeHtml(entity.blocked_by)}</td>
                        <td>${new Date(entity.created_at).toLocaleDateString()}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-success" onclick="unblockEntity(${entity.id})">
                                <i class="fas fa-unlock"></i> Unblock
                            </button>
                        </td>
                    </tr>
                `;
            });
        }
        
        html += '</tbody></table></div>';
        document.getElementById('blockedEntitiesTable').innerHTML = html;
        
    } catch (error) {
        document.getElementById('blockedEntitiesTable').innerHTML = '<p class="text-danger">Failed to load blocked entities: ' + error.message + '</p>';
    }
}

// Show block entity modal
function showBlockEntityModal() {
    const modal = new bootstrap.Modal(document.getElementById('blockEntityModal'));
    modal.show();
}

// Block entity
async function blockEntity() {
    const type = document.getElementById('blockEntityType').value;
    const value = document.getElementById('blockEntityValue').value;
    const reason = document.getElementById('blockEntityReason').value;
    
    if (!type || !value) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    try {
        await apiRequest('/api/admin/block', {
            method: 'POST',
            body: JSON.stringify({ type, value, reason })
        });
        
        showToast('Entity blocked successfully', 'success');
        bootstrap.Modal.getInstance(document.getElementById('blockEntityModal')).hide();
        document.getElementById('blockEntityForm').reset();
        loadBlockedEntities();
    } catch (error) {
        showToast('Failed to block entity: ' + error.message, 'error');
    }
}

// Unblock entity
async function unblockEntity(entityId) {
    if (!confirm('Are you sure you want to unblock this entity?')) return;
    
    try {
        await apiRequest(`/api/admin/block/${entityId}`, {
            method: 'DELETE'
        });
        
        showToast('Entity unblocked successfully', 'success');
        loadBlockedEntities();
    } catch (error) {
        showToast('Failed to unblock entity: ' + error.message, 'error');
    }
}

// Load transactions
async function loadTransactions() {
    try {
        const status = document.getElementById('transactionStatusFilter').value;
        const endpoint = status ? `/api/admin/transactions?status=${status}` : '/api/admin/transactions';
        const data = await apiRequest(endpoint);
        const transactions = data.data.transactions;
        
        let html = `
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>TXID</th>
                            <th>User</th>
                            <th>Amount</th>
                            <th>Fee</th>
                            <th>Status</th>
                            <th>Date</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        if (transactions.length === 0) {
            html += '<tr><td colspan="6" class="text-center text-muted">No transactions found</td></tr>';
        } else {
            transactions.forEach(tx => {
                const statusClass = `status-${tx.status}`;
                
                html += `
                    <tr>
                        <td class="text-truncate-custom" title="${tx.txid}">${tx.txid}</td>
                        <td>${escapeHtml(tx.username || 'Unknown')}</td>
                        <td>${tx.amount} AEGS</td>
                        <td>${tx.fee} AEGS</td>
                        <td><span class="badge ${statusClass}">${tx.status}</span></td>
                        <td>${new Date(tx.created_at).toLocaleDateString()}</td>
                    </tr>
                `;
            });
        }
        
        html += '</tbody></table></div>';
        document.getElementById('transactionsTable').innerHTML = html;
        
    } catch (error) {
        document.getElementById('transactionsTable').innerHTML = '<p class="text-danger">Failed to load transactions: ' + error.message + '</p>';
    }
}

// Load fee settings
async function loadFeeSettings() {
    try {
        const data = await apiRequest('/api/admin/fee-settings');
        const settings = data.data;
        
        // Set form values
        document.querySelector(`input[name="feeType"][value="${settings.type}"]`).checked = true;
        document.getElementById('feeAmount').value = settings.amount;
        document.getElementById('feeAddress').value = settings.address;
        
        // Update help text
        updateFeeAmountHelp();
        
    } catch (error) {
        showToast('Failed to load fee settings: ' + error.message, 'error');
    }
}

// Update fee amount help text
function updateFeeAmountHelp() {
    const feeType = document.querySelector('input[name="feeType"]:checked').value;
    const helpText = feeType === 'flat' 
        ? 'Enter amount in AEGS for flat fee' 
        : 'Enter percentage (e.g., 5 for 5%)';
    document.getElementById('feeAmountHelp').textContent = helpText;
}

// Handle fee type change
document.querySelectorAll('input[name="feeType"]').forEach(radio => {
    radio.addEventListener('change', updateFeeAmountHelp);
});

// Handle fee settings form submission
document.getElementById('feeSettingsForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const type = document.querySelector('input[name="feeType"]:checked').value;
    const amount = parseFloat(document.getElementById('feeAmount').value);
    const address = document.getElementById('feeAddress').value;
    
    try {
        await apiRequest('/api/admin/fee-settings', {
            method: 'PUT',
            body: JSON.stringify({ type, amount, address })
        });
        
        showToast('Fee settings updated successfully', 'success');
    } catch (error) {
        showToast('Failed to update fee settings: ' + error.message, 'error');
    }
});

// Load suspicious activity
async function loadSuspiciousActivity() {
    try {
        const data = await apiRequest('/api/admin/suspicious-activity');
        const { suspiciousIPs, suspiciousUsers } = data.data;
        
        let html = `
            <div class="row">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">
                            <h5>Suspicious IP Addresses</h5>
                            <small class="text-muted">IPs with multiple user accounts</small>
                        </div>
                        <div class="card-body">
        `;
        
        if (suspiciousIPs.length === 0) {
            html += '<p class="text-muted">No suspicious IP activity detected</p>';
        } else {
            html += '<div class="table-responsive"><table class="table table-sm">';
            html += '<thead><tr><th>IP Address</th><th>Users</th><th>Requests</th><th>Last Activity</th></tr></thead><tbody>';
            
            suspiciousIPs.forEach(ip => {
                html += `
                    <tr>
                        <td>${escapeHtml(ip.ip_address)}</td>
                        <td><span class="badge bg-warning">${ip.unique_users}</span></td>
                        <td>${ip.total_requests}</td>
                        <td>${new Date(ip.last_activity).toLocaleDateString()}</td>
                    </tr>
                `;
            });
            
            html += '</tbody></table></div>';
        }
        
        html += `
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">
                            <h5>Suspicious Users</h5>
                            <small class="text-muted">Users with multiple IP addresses</small>
                        </div>
                        <div class="card-body">
        `;
        
        if (suspiciousUsers.length === 0) {
            html += '<p class="text-muted">No suspicious user activity detected</p>';
        } else {
            html += '<div class="table-responsive"><table class="table table-sm">';
            html += '<thead><tr><th>Username</th><th>IPs</th><th>Requests</th><th>Last Activity</th></tr></thead><tbody>';
            
            suspiciousUsers.forEach(user => {
                html += `
                    <tr>
                        <td>${escapeHtml(user.username)}</td>
                        <td><span class="badge bg-warning">${user.unique_ips}</span></td>
                        <td>${user.total_requests}</td>
                        <td>${new Date(user.last_activity).toLocaleDateString()}</td>
                    </tr>
                `;
            });
            
            html += '</tbody></table></div>';
        }
        
        html += `
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('suspiciousActivityContent').innerHTML = html;
        
    } catch (error) {
        document.getElementById('suspiciousActivityContent').innerHTML = '<p class="text-danger">Failed to load suspicious activity: ' + error.message + '</p>';
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    const toastId = 'toast-' + Date.now();
    
    const bgClass = {
        'success': 'bg-success',
        'error': 'bg-danger',
        'warning': 'bg-warning',
        'info': 'bg-info'
    }[type] || 'bg-info';
    
    const toastHtml = `
        <div id="${toastId}" class="toast ${bgClass} text-white" role="alert">
            <div class="toast-header ${bgClass} text-white border-0">
                <strong class="me-auto">Notification</strong>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
            </div>
            <div class="toast-body">
                ${escapeHtml(message)}
            </div>
        </div>
    `;
    
    toastContainer.insertAdjacentHTML('beforeend', toastHtml);
    
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, { delay: 5000 });
    toast.show();
    
    // Remove toast element after it's hidden
    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}