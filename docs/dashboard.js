import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

// Supabase config
const SUPABASE_URL = 'https://nnixqnoxlhdncoppukvw.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uaXhxbm94bGhkbmNvcHB1a3Z3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MzMyNjIsImV4cCI6MjA3NjQwOTI2Mn0.F2vIAkiX29Bqe7jpJhYPRzjUNJ3n0Fs3Emca-8I9JuE'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// DOM Elements
const walletCreationModal = document.getElementById('wallet-creation-modal')
const walletCreationForm = document.getElementById('wallet-creation-form')
const dashboardContent = document.getElementById('dashboard-content')
const userDisplayName = document.getElementById('user-display-name')
const userAvatar = document.getElementById('user-avatar')
const totalBkTokens = document.getElementById('total-bk-tokens')
const usdEquivalent = document.getElementById('usd-equivalent')
const spotBalance = document.getElementById('spot-balance')
const spotUsd = document.getElementById('spot-usd')
const futuresBalance = document.getElementById('futures-balance')
const futuresUsd = document.getElementById('futures-usd')
const futuresUsdtBalance = document.getElementById('futures-usdt-balance')
const fromAvailable = document.getElementById('from-available')
const toAvailable = document.getElementById('to-available')
const fromToken = document.getElementById('from-token')
const toToken = document.getElementById('to-token')
const maxAvailableAmount = document.getElementById('max-available-amount')
const maxToken = document.getElementById('max-token')
const transferTokenName = document.getElementById('transfer-token-name')
const transferAmount = document.getElementById('transfer-amount')
const transferFrom = document.getElementById('transfer-from')
const transferTo = document.getElementById('transfer-to')
const submitTransfer = document.getElementById('submit-transfer')
const maxTransfer = document.getElementById('max-transfer')
const checkinBtn = document.getElementById('checkin-btn')
const checkinStatus = document.getElementById('checkin-status')
const spinBtn = document.getElementById('spin-btn')
const exchangeBtn = document.getElementById('exchange-btn')
const quickExchangeBtn = document.getElementById('quick-exchange-btn')
const withdrawBtn = document.getElementById('withdraw-btn')
const withdrawModal = document.getElementById('withdraw-modal')
const exchangeModal = document.getElementById('exchange-modal')
const closeWithdrawModal = document.getElementById('close-withdraw-modal')
const closeExchangeModal = document.getElementById('close-exchange-modal')
const withdrawForm = document.getElementById('withdraw-form')
const exchangeForm = document.getElementById('exchange-form')
const withdrawWalletAddress = document.getElementById('withdraw-wallet-address')
const withdrawFullName = document.getElementById('withdraw-full-name')
const withdrawAmountInput = document.getElementById('withdraw-amount')
const exchangeAmount = document.getElementById('exchange-amount')
const exchangeEstimate = document.getElementById('exchange-estimate')
const exchangeAvailableBalance = document.getElementById('exchange-available-balance')
const notification = document.getElementById('notification')
const manageAddressBtn = document.getElementById('manage-address-btn')
const manageAddressModal = document.getElementById('manage-address-modal')
const closeManageAddress = document.getElementById('close-manage-address')
const manageAddressForm = document.getElementById('manage-address-form')
const manageWalletAddress = document.getElementById('manage-wallet-address')
const manageFullName = document.getElementById('manage-full-name')
const saveAddressBtn = document.getElementById('save-address-btn')
const removeAddressBtn = document.getElementById('remove-address-btn')
const openManageAddressFromWithdraw = document.getElementById('open-manage-address-from-withdraw')
const logoutBtn = document.getElementById('logout-btn')
const historyBtn = document.getElementById('history-btn')

// Transfer quick buttons
const transferToFuturesBtn = document.getElementById('transfer-to-futures')
const transferToSpotBtn = document.getElementById('transfer-to-spot')

// State
let currentUser = null
let wallets = {}
let lastCheckin = null
let savedAddress = null
let exchangeRate = 0.001 // fallback; we'll try to read from DB

// Helper: show notification
function showNotification(message, isError = false, timeout = 3500) {
    notification.textContent = message
    notification.className = 'notification' + (isError ? ' error' : '')
    notification.style.display = 'block'
    clearTimeout(window._notifTimer)
    window._notifTimer = setTimeout(() => notification.style.display = 'none', timeout)
}

// Initialize dashboard
async function initDashboard() {
    try {
        const { data: authData, error: authErr } = await supabase.auth.getUser()
        if (authErr || !authData?.user) {
            // not signed in
            window.location.href = 'signup.html'
            return
        }
        currentUser = authData.user

        // UI user info
        const displayName = currentUser.email?.split('@')[0] || (currentUser.user_metadata?.full_name || 'User')
        userDisplayName.textContent = displayName
        userAvatar.textContent = displayName.charAt(0).toUpperCase()

        // Check if user has wallets
        const hasWallets = await checkUserWallets()
        
        if (!hasWallets) {
            // Show wallet creation modal
            walletCreationModal.style.display = 'flex'
            dashboardContent.style.display = 'none'
            return
        }

        // Load core resources in parallel
        await Promise.all([
            loadExchangeRate(),
            loadSavedAddress(),
            loadCheckinStatus()
        ])

        fetchwallet().catch(err => console.error(err));
        updateBalancesUI();
        updateTransferUI();
        
        // Show dashboard content
        walletCreationModal.style.display = 'none'
        dashboardContent.style.display = 'block'
    } catch (err) {
        console.error('init error', err)
        showNotification('Failed to initialize dashboard', true)
    }
}

// Check if user has wallets
async function checkUserWallets() {
    if (!currentUser) return false
    
    try {
        const { data, error } = await supabase
            .from('wallets')
            .select('id')
            .eq('user_id', currentUser.id)
            .limit(1)
            
        if (error) throw error
        return data && data.length > 0
    } catch (err) {
        console.error('check wallets error', err)
        return false
    }
}

// Create user wallets
async function createUserWallets(fullName, walletAddress) {
    if (!currentUser) return false
    
    try {
        // Create spot wallet
        const { error: spotError } = await supabase
            .from('wallets')
            .insert({
                user_id: currentUser.id,
                wallet_type: 'spot',
                balance: 0,
                token_symbol: 'BK'
            })
            
        if (spotError) throw spotError
        
        // Create futures wallet
        const { error: futuresError } = await supabase
            .from('wallets')
            .insert({
                user_id: currentUser.id,
                wallet_type: 'futures',
                balance: 0,
                token_symbol: 'USDT'
            })
            
        if (futuresError) throw futuresError
        
        // Save withdrawal address if provided
        if (walletAddress) {
            const { error: addressError } = await supabase
                .from('withdrawal_addresses')
                .upsert({
                    user_id: currentUser.id,
                    wallet_address: walletAddress,
                    full_name: fullName,
                    is_default: true
                }, { onConflict: 'user_id' })
                
            if (addressError) throw addressError
        }
        
        return true
    } catch (err) {
        console.error('create wallets error', err)
        return false
    }
}

// Load wallets into wallets state
async function fetchwallet() {
    if (!currentUser) return
    try {
        const { data, error } = await supabase
            .from('wallets')
            .select('*')
            .eq('user_id', currentUser.id)

        if (error) throw error
        wallets = {}
if (Array.isArray(data)) {
    data.forEach(w => wallets[w.wallet_type] = w)
} else {
    console.warn('Unexpected wallet data:', data)
}

        // fallback: ensure token symbols for known wallets
        if (!wallets.spot) wallets.spot = { balance: 0, token_symbol: 'BK' }
        if (!wallets.futures) wallets.futures = { balance: 0, token_symbol: 'USDT' }

    } catch (err) {
        console.error('loadWallets error', err)
        showNotification('Failed to load wallets', true)
    }
}

// Load exchange rate
async function loadExchangeRate() {
    try {
        const { data, error } = await supabase
            .from('exchange_rates')
            .select('rate')
            .eq('from_token', 'BK')
            .eq('to_token', 'USDT')
            .single()

        if (!error && data) exchangeRate = data.rate
        document.getElementById('rate-value').textContent = `1000 BK = 1 USDT`
    } catch (err) {
        console.warn('loadExchangeRate fallback', err)
    }
}

// Load saved withdrawal address (default)
async function loadSavedAddress() {
    if (!currentUser) return
    try {
        const { data, error } = await supabase
            .from('withdrawal_addresses')
            .select('wallet_address, full_name')
            .eq('user_id', currentUser.id)
            .eq('is_default', true)
            .single()

        if (!error && data) {
            savedAddress = data
            withdrawWalletAddress.value = data.wallet_address || ''
            withdrawFullName.value = data.full_name || ''
            manageWalletAddress.value = data.wallet_address || ''
            manageFullName.value = data.full_name || ''
        } else {
            savedAddress = null
        }
    } catch (err) {
        console.warn('no saved withdrawal address', err)
    }
}

// Load check-in status
async function loadCheckinStatus() {
    try {
        const today = new Date().toISOString().split('T')[0]
        const { data, error } = await supabase
            .from('daily_checkins')
            .select('created_at')
            .eq('user_id', currentUser.id)
            .eq('checkin_date', today)
            .single()

        if (!error && data) {
            lastCheckin = new Date(data.created_at)
            checkinBtn.disabled = true
            checkinBtn.textContent = 'Already Checked In'
            checkinStatus.textContent = 'Last checked in: Today'
        } else {
            checkinBtn.disabled = false
            checkinBtn.textContent = 'Claim Now'
            checkinStatus.textContent = 'Last checked in: Never'
        }
    } catch (err) {
        checkinBtn.disabled = false
        checkinBtn.textContent = 'Claim Now'
        checkinStatus.textContent = 'Last checked in: Never'
    }
}

// Update balances UI
function updateBalancesUI() {
    const spotWallet = wallets.spot || { balance: 0, token_symbol: 'BK' }
    const futuresWallet = wallets.futures || { balance: 0, token_symbol: 'USDT' }

    totalBkTokens.textContent = `${parseFloat(spotWallet.balance || 0).toFixed(2)} ${spotWallet.token_symbol}`
    usdEquivalent.textContent = (parseFloat(spotWallet.balance || 0) * exchangeRate).toFixed(2)

    spotBalance.textContent = `${parseFloat(spotWallet.balance || 0).toFixed(2)} ${spotWallet.token_symbol}`
    spotUsd.textContent = (parseFloat(spotWallet.balance || 0) * exchangeRate).toFixed(2)

    futuresBalance.textContent = `${parseFloat(futuresWallet.balance || 0).toFixed(4)} ${futuresWallet.token_symbol}`
    futuresUsd.textContent = parseFloat(futuresWallet.balance || 0).toFixed(2)
    futuresUsdtBalance.textContent = parseFloat(futuresWallet.balance || 0).toFixed(4)

    exchangeAvailableBalance.textContent = `${parseFloat(spotWallet.balance || 0).toFixed(2)} ${spotWallet.token_symbol}`
    updateExchangeEstimate()
}

// Update transfer UI
function updateTransferUI() {
    const fromWalletType = transferFrom.value
    const toWalletType = transferTo.value

    const fromWallet = wallets[fromWalletType] || { token_symbol: fromWalletType === 'spot' ? 'BK' : 'USDT', balance: 0 }
    const toWallet = wallets[toWalletType] || { token_symbol: toWalletType === 'spot' ? 'BK' : 'USDT', balance: 0 }

    fromToken.textContent = fromWallet.token_symbol
    toToken.textContent = toWallet.token_symbol
    maxToken.textContent = fromWallet.token_symbol
    transferTokenName.textContent = fromWallet.token_symbol === 'BK' ? 'BK Token' : 'USDT Token'

    const fromBalance = fromWallet.balance || 0
    const toBalance = toWallet.balance || 0

    fromAvailable.textContent = parseFloat(fromBalance).toFixed(fromWallet.token_symbol === 'BK' ? 2 : 4)
    toAvailable.textContent = parseFloat(toBalance).toFixed(toWallet.token_symbol === 'BK' ? 2 : 4)
    maxAvailableAmount.textContent = parseFloat(fromBalance).toFixed(fromWallet.token_symbol === 'BK' ? 2 : 4)

    maxTransfer.disabled = parseFloat(fromBalance) <= 0
}

// Update exchange estimate
function updateExchangeEstimate() {
    const amount = parseFloat(exchangeAmount.value) || 0
    const estimate = amount * exchangeRate
    exchangeEstimate.textContent = estimate.toFixed(4)
}

// Transfer handler
async function handleTransfer(e) {
    if (e) e.preventDefault()
    const fromWalletType = transferFrom.value
    const toWalletType = transferTo.value
    const amount = parseFloat(transferAmount.value)

    if (!amount || amount <= 0) {
        showNotification('Please enter a valid amount', true)
        return
    }

    const fromWallet = wallets[fromWalletType]
    const toWallet = wallets[toWalletType]
    if (!fromWallet || !toWallet) {
        showNotification('Wallets not found', true)
        return
    }

    if (fromWallet.token_symbol !== toWallet.token_symbol) {
        showNotification('Transfers only allowed between same token types', true)
        return
    }

    if (amount > parseFloat(fromWallet.balance || 0)) {
        showNotification('Insufficient balance', true)
        return
    }

    try {
        submitTransfer.disabled = true
        const { error } = await supabase.rpc('transfer_tokens', {
            p_user_id: currentUser.id,
            p_from_wallet_id: fromWallet.id,
            p_to_wallet_id: toWallet.id,
            p_amount: amount
        })
        if (error) throw error
        await loadWallets()
        updateBalancesUI()
        transferAmount.value = ''
        showNotification(`Successfully transferred ${amount} ${fromWallet.token_symbol}`)
    } catch (err) {
        console.error('Transfer error:', err)
        showNotification('Transfer failed: ' + (err.message || JSON.stringify(err)), true)
    } finally {
        submitTransfer.disabled = false
    }
}

// Checkin
async function handleCheckin(e) {
    if (e) e.preventDefault()
    try {
        checkinBtn.disabled = true
        const { error: awardError } = await supabase.rpc('award_checkin_tokens', {
            p_user_id: currentUser.id,
            p_amount: 50
        })
        if (awardError) throw awardError
        await supabase.from('daily_checkins').insert({
            user_id: currentUser.id,
            checkin_date: new Date().toISOString().split('T')[0],
            tokens_earned: 50
        })
        await loadWallets()
        updateBalancesUI()
        loadCheckinStatus()
        showNotification('50 BK tokens awarded for daily check-in!')
    } catch (err) {
        console.error('checkin error', err)
        showNotification('Check-in failed: ' + (err.message || 'Unknown error'), true)
        checkinBtn.disabled = false
    }
}

// Spin
async function handleSpin(e) {
    if (e) e.preventDefault()
    try {
        spinBtn.disabled = true
        const { error: spinError } = await supabase.rpc('deduct_spin_cost', {
            p_user_id: currentUser.id
        })
        if (spinError) throw spinError

        // simple prize logic (server ideally should do this)
        const prizes = [0, 0, 0, 1, 10, 100]
        const prize = Math.random() > 0.9 ? prizes[Math.floor(Math.random() * prizes.length)] : 0
        if (prize > 0) {
            const { error: awardError } = await supabase.rpc('award_spin_prize', {
                p_user_id: currentUser.id,
                p_amount: prize
            })
            if (awardError) throw awardError
        }
        await supabase.from('spin_records').insert({
            user_id: currentUser.id,
            tokens_spent: 1,
            prize_won: `${prize}bk`,
            tokens_won: prize
        })
        await loadWallets()
        updateBalancesUI()
        showNotification(prize > 0 ? `You won ${prize} BK!` : 'No prize this time. Try again.')
    } catch (err) {
        console.error('spin error', err)
        showNotification('Spin failed: ' + (err.message || 'Unknown error'), true)
    } finally {
        spinBtn.disabled = false
    }
}

// Withdraw
async function handleWithdraw(e) {
    e.preventDefault()
    const address = withdrawWalletAddress.value.trim()
    const name = withdrawFullName.value.trim()
    const amount = parseFloat(withdrawAmountInput.value)

    if (!address || !name) {
        showNotification('Please fill address and full name before withdrawing', true)
        return
    }
    if (!amount || amount < 1) {
        showNotification('Minimum withdrawal is 1 USDT', true)
        return
    }

    const futuresWallet = wallets.futures || { balance: 0, token_symbol: 'USDT' }
    if (amount > parseFloat(futuresWallet.balance || 0)) {
        showNotification('Insufficient USDT balance for withdrawal', true)
        return
    }

    try {
        // Save/update address (so user doesn't have to enter every time)
        const { error: addressError } = await supabase
            .from('withdrawal_addresses')
            .upsert({
                user_id: currentUser.id,
                wallet_address: address,
                full_name: name,
                is_default: true
            }, { onConflict: 'user_id' })

        if (addressError) throw addressError

        // Call the RPC to process withdrawal (server handles actual execution)
        const { error: withdrawError } = await supabase.rpc('process_withdrawal', {
            p_user_id: currentUser.id,
            p_amount: amount,
            p_address: address,
            p_token_symbol: 'USDT'
        })

        if (withdrawError) throw withdrawError

        // Refresh
        await loadWallets()
        updateBalancesUI()
        withdrawModal.style.display = 'none'
        withdrawForm.reset()
        showNotification(`Withdrawal of ${amount} USDT initiated!`)
    } catch (err) {
        console.error('Withdrawal error:', err)
        // Provide the server message if present
        const msg = err?.message || JSON.stringify(err)
        showNotification('Withdrawal failed: ' + msg, true)
    }
}

// Exchange
async function handleExchange(e) {
    e.preventDefault()
    const amount = parseFloat(exchangeAmount.value)
    if (!amount || amount < 1000) {
        showNotification('Minimum exchange is 1000 BK', true)
        return
    }
    const spotWallet = wallets.spot || { balance: 0 }
    if (amount > parseFloat(spotWallet.balance || 0)) {
        showNotification('Insufficient BK balance for exchange', true)
        return
    }

    try {
        // Disable UI while processing
        exchangeForm.querySelector('button[type="submit"]').disabled = true

        // Call RPC to exchange BK -> USDT
        const { error: exchangeError } = await supabase.rpc('exchange_bk_to_usdt', {
            p_user_id: currentUser.id,
            p_bk_amount: amount
        })
        if (exchangeError) throw exchangeError

        // refresh wallets & UI
        await Promise.all([loadWallets(), loadExchangeRate()])
        updateBalancesUI()
        exchangeModal.style.display = 'none'
        exchangeForm.reset()
        showNotification(`Successfully exchanged ${amount} BK to ${(amount * exchangeRate).toFixed(4)} USDT!`)
    } catch (err) {
        console.error('Exchange error:', err)
        const msg = err?.message || JSON.stringify(err)
        // Common server errors may be token mismatch or futures wallet missing; surface the message
        showNotification('Exchange failed: ' + msg, true)
    } finally {
        exchangeForm.querySelector('button[type="submit"]').disabled = false
    }
}

// Manage address save
async function handleSaveAddress(e) {
    if (e) e.preventDefault()
    const address = manageWalletAddress.value.trim()
    const name = manageFullName.value.trim()

    try {
        saveAddressBtn.disabled = true
        const { error } = await supabase
            .from('withdrawal_addresses')
            .upsert({
                user_id: currentUser.id,
                wallet_address: address,
                full_name: name,
                is_default: true
            }, { onConflict: 'user_id' })
        if (error) throw error
        await loadSavedAddress()
        showNotification('Address saved')
        manageAddressModal.style.display = 'none'
    } catch (err) {
        console.error('save address error', err)
        showNotification('Save failed: ' + (err.message || JSON.stringify(err)), true)
    } finally {
        saveAddressBtn.disabled = false
    }
}

// Remove address
async function handleRemoveAddress() {
    try {
        removeAddressBtn.disabled = true
        const { error } = await supabase
            .from('withdrawal_addresses')
            .update({ wallet_address: '', full_name: '' })
            .eq('user_id', currentUser.id)
        if (error) throw error
        manageWalletAddress.value = ''
        manageFullName.value = ''
        withdrawWalletAddress.value = ''
        withdrawFullName.value = ''
        savedAddress = null
        showNotification('Address removed')
        manageAddressModal.style.display = 'none'
    } catch (err) {
        console.error('remove address error', err)
        showNotification('Removal failed', true)
    } finally {
        removeAddressBtn.disabled = false
    }
}

// Logout
async function handleLogout() {
    try {
        await supabase.auth.signOut()
    } catch (err) {
        console.warn('logout error', err)
    } finally {
        window.location.href = 'signup.html'
    }
}

// Handle wallet creation form submission
async function handleWalletCreation(e) {
    e.preventDefault()
    
    const fullName = document.getElementById('full-name').value.trim()
    const walletAddress = document.getElementById('wallet-address').value.trim()
    
    if (!fullName) {
        showNotification('Please enter your full name', true)
        return
    }
    
    try {
        walletCreationForm.querySelector('button').disabled = true
        const success = await createUserWallets(fullName, walletAddress)
        
        if (success) {
            showNotification('Wallets created successfully!')
            walletCreationModal.style.display = 'none'
            dashboardContent.style.display = 'block'
            
            // Re-initialize dashboard
            await initDashboard()
        } else {
            showNotification('Failed to create wallets', true)
        }
    } catch (err) {
        console.error('wallet creation error', err)
        showNotification('Wallet creation failed', true)
    } finally {
        walletCreationForm.querySelector('button').disabled = false
    }
}

// Utilities: open/close modals
function openModal(el){ el.style.display='flex' }
function closeModal(el){ el.style.display='none' }

// Event listeners wiring
transferFrom.addEventListener('change', updateTransferUI)
transferTo.addEventListener('change', updateTransferUI)

maxTransfer.addEventListener('click', () => {
    const fromWallet = wallets[transferFrom.value] || { balance: 0, token_symbol: 'BK' }
    transferAmount.value = parseFloat(fromWallet.balance || 0).toFixed(fromWallet.token_symbol === 'BK' ? 2 : 4)
})
submitTransfer.addEventListener('click', handleTransfer)
checkinBtn.addEventListener('click', handleCheckin)
spinBtn.addEventListener('click', handleSpin)
withdrawBtn.addEventListener('click', () => openModal(withdrawModal))
exchangeBtn.addEventListener('click', () => openModal(exchangeModal))
quickExchangeBtn.addEventListener('click', () => openModal(exchangeModal))
closeWithdrawModal.addEventListener('click', () => closeModal(withdrawModal))
closeExchangeModal.addEventListener('click', () => closeModal(exchangeModal))
withdrawForm.addEventListener('submit', handleWithdraw)
exchangeForm.addEventListener('submit', handleExchange)
exchangeAmount.addEventListener('input', updateExchangeEstimate)

manageAddressBtn.addEventListener('click', () => openModal(manageAddressModal))
closeManageAddress.addEventListener('click', () => closeModal(manageAddressModal))
manageAddressForm.addEventListener('submit', handleSaveAddress)
saveAddressBtn.addEventListener('click', handleSaveAddress)
removeAddressBtn.addEventListener('click', handleRemoveAddress)
openManageAddressFromWithdraw.addEventListener('click', () => {
    closeModal(withdrawModal); openModal(manageAddressModal)
})

logoutBtn.addEventListener('click', handleLogout)
historyBtn.addEventListener('click', () => { window.location.href = 'history.html' })

transferToFuturesBtn.addEventListener('click', () => {
    transferFrom.value = 'spot'; transferTo.value = 'futures'; updateTransferUI()
})
transferToSpotBtn.addEventListener('click', () => {
    transferFrom.value = 'futures'; transferTo.value = 'spot'; updateTransferUI()
})

// Wallet creation form
walletCreationForm.addEventListener('submit', handleWalletCreation)

// Close modals on background click
window.addEventListener('click', (e) => {
    if (e.target === withdrawModal) closeModal(withdrawModal)
    if (e.target === exchangeModal) closeModal(exchangeModal)
    if (e.target === manageAddressModal) closeModal(manageAddressModal)
    if (e.target === walletCreationModal) closeModal(walletCreationModal)
})

// Initialize
document.addEventListener('DOMContentLoaded', initDashboard)
