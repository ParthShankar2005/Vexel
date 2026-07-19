'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, Wallet, HelpCircle, LogOut, Upload, Image as ImageIcon, 
  Download, Archive, CheckCircle2, ChevronRight, Zap, MessageSquare, 
  Loader2, AlertCircle, ShoppingBag, FileText, Send, Paperclip, Clock
} from 'lucide-react';
import io from 'socket.io-client';
import confetti from 'canvas-confetti';
import { API_BASE_URL } from '../utils/api';

// Helper to convert files to base64
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
};

export default function UserApp({ token, user, onLogout }) {
  const [activeTab, setActiveTab] = useState('generate'); // 'generate', 'billing', 'support'
  const [profile, setProfile] = useState(null);
  
  // Image Generator State (Prompt state is hidden/automatic)
  const [productFile, setProductFile] = useState(null);
  const [productPreview, setProductPreview] = useState(null);
  const [changeBgOnly, setChangeBgOnly] = useState(true);
  const [imageCount, setImageCount] = useState(4);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationQueue, setGenerationQueue] = useState('In Queue');
  const [generatedImages, setGeneratedImages] = useState([]);
  const [selectedImages, setSelectedImages] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  // Billing/Offer Engine State
  const [plans, setPlans] = useState([]);
  const [offerState, setOfferState] = useState(null);
  const [offerProgress, setOfferProgress] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [invoiceHistory, setInvoiceHistory] = useState([]);
  const [timeText, setTimeText] = useState('');

  // Support Chat State
  const [tickets, setTickets] = useState([]);
  const [activeTicket, setActiveTicket] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatAttachment, setChatAttachment] = useState(null);
  const [chatLoading, setChatLoading] = useState(false);
  const fileInputRef = useRef(null);
  const chatBottomRef = useRef(null);
  const socketRef = useRef(null);

  // Fetch initial profile, plans, offer progress, invoice history
  useEffect(() => {
    fetchProfile();
    fetchPlans();
    fetchOfferState();
    fetchOfferProgress();
    fetchInvoiceHistory();
    fetchTickets();
  }, []);

  // Set up WebSocket Support Chat
  useEffect(() => {
    socketRef.current = io(API_BASE_URL);

    socketRef.current.on('connect', () => {
      console.log('Socket chat connected:', socketRef.current.id);
      if (user) {
        socketRef.current.emit('join_room', user.id);
      }
    });

    socketRef.current.on('receive_message', (msg) => {
      if (activeTicket && msg.ticketId === activeTicket.id) {
        setChatMessages(prev => [...prev, msg]);
        setTimeout(() => {
          chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
      fetchTickets();
    });

    if (window.electronAPI) {
      window.electronAPI.onPaymentSuccess((data) => {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });
        alert('Payment processed successfully! Credits have been added to your account.');
        fetchProfile();
        fetchOfferProgress();
        fetchInvoiceHistory();
        setPaymentLoading(false);
      });

      window.electronAPI.onPaymentFailed((data) => {
        alert('Payment verification failed or was cancelled.');
        setPaymentLoading(false);
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [activeTicket]);

  // Offer Engine Countdown Timer
  useEffect(() => {
    if (!offerState || !offerState.isActive) return;

    let remaining = offerState.timeRemaining;
    const interval = setInterval(() => {
      remaining -= 1000;
      if (remaining <= 0) {
        clearInterval(interval);
        fetchOfferState();
      } else {
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((remaining % (1000 * 60)) / 1000);
        setTimeText(`${hours}h ${mins}m ${secs}s`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [offerState]);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setProfile(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPlans = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/plans`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setPlans(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchOfferState = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/offers/state`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setOfferState(data);
        if (data.isActive) {
          const hours = Math.floor(data.timeRemaining / (1000 * 60 * 60));
          const mins = Math.floor((data.timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
          const secs = Math.floor((data.timeRemaining % (1000 * 60)) / 1000);
          setTimeText(`${hours}h ${mins}m ${secs}s`);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchOfferProgress = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/offers/progress`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setOfferProgress(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchInvoiceHistory = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/payments/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setInvoiceHistory(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleProductUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'image/png') {
      setErrorMsg('Only PNG format files are accepted.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('File size exceeds the 5MB limit.');
      return;
    }

    setErrorMsg('');
    setProductFile(file);
    setProductPreview(URL.createObjectURL(file));
  };

  // Cloudflare AI Generations (Uses system default prompt in backend)
  const handleGenerate = async () => {
    if (!productFile) {
      setErrorMsg('Please upload a product PNG image first.');
      return;
    }

    const creditsNeeded = imageCount * 2;
    if (profile && profile.wallet.credits < creditsNeeded) {
      setErrorMsg(`Insufficient credits. Required: ${creditsNeeded}, Balance: ${profile.wallet.credits}`);
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(10);
    setGenerationQueue('Queue validation...');
    setErrorMsg('');
    setGeneratedImages([]);
    setSelectedImages([]);

    const progressInterval = setInterval(() => {
      setGenerationProgress(prev => {
        if (prev < 85) {
          if (prev === 20) setGenerationQueue('Initializing Cloudflare AI Instance...');
          if (prev === 40) setGenerationQueue('Running Stable Diffusion Model...');
          if (prev === 60) setGenerationQueue('Compositing product transparent layers...');
          if (prev === 80) setGenerationQueue('Rendering high quality graphics...');
          return prev + 5;
        }
        return prev;
      });
    }, 800);

    try {
      const base64Image = await fileToBase64(productFile);

      const res = await fetch(`${API_BASE_URL}/api/generate/images`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          changeBackgroundOnly: changeBgOnly ? 'true' : 'false',
          count: imageCount.toString(),
          productImage: base64Image
        })
      });

      const data = await res.json();
      clearInterval(progressInterval);

      if (!res.ok) {
        throw new Error(data.error || 'Generation failed');
      }

      setGenerationProgress(100);
      setGenerationQueue('Complete!');

      const formattedUrls = data.images.map(img => `${API_BASE_URL}${img}`);
      setGeneratedImages(formattedUrls);
      fetchProfile();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      clearInterval(progressInterval);
      setTimeout(() => {
        setIsGenerating(false);
      }, 800);
    }
  };

  const downloadSingle = (url) => {
    window.open(url, '_blank');
  };

  const downloadAllSelectedZip = async () => {
    if (selectedImages.length === 0) return;
    const relativePaths = selectedImages.map(url => url.replace(API_BASE_URL, ''));
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/generate/download-zip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ imageIds: relativePaths })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ZIP packing failed');

      alert(`Selected images packed in ZIP archive!\nSaved at: ${data.zipPath}`);
    } catch (err) {
      alert('Generating ZIP archive locally: ' + err.message);
    }
  };

  const toggleImageSelect = (url) => {
    if (selectedImages.includes(url)) {
      setSelectedImages(prev => prev.filter(x => x !== url));
    } else {
      setSelectedImages(prev => [...prev, url]);
    }
  };

  const handleBuyPlan = async (planId) => {
    setPaymentLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/payments/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ planId })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Order creation failed');

      if (window.electronAPI) {
        const paymentUrl = `${API_BASE_URL}/api/payments/pay-window?orderId=${data.orderId}&transactionId=${data.transactionId}&amount=${data.amount}&key=${data.razorpayKeyId}&email=${user.email}`;
        await window.electronAPI.openPaymentWindow(paymentUrl);
      } else {
        setTimeout(async () => {
          const verifyRes = await fetch(`${API_BASE_URL}/api/payments/verify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              razorpay_payment_id: `pay_mock_${Date.now()}`,
              razorpay_order_id: data.orderId,
              razorpay_signature: 'mock_signature',
              transactionId: data.transactionId
            })
          });
          const verifyData = await verifyRes.json();
          if (verifyRes.ok) {
            confetti({ particleCount: 150, spread: 80 });
            alert('Mock Payment Successful! Credits added.');
            fetchProfile();
            fetchOfferProgress();
            fetchInvoiceHistory();
          } else {
            alert('Verification failed: ' + verifyData.error);
          }
          setPaymentLoading(false);
        }, 2000);
      }
    } catch (err) {
      alert(err.message);
      setPaymentLoading(false);
    }
  };

  const fetchTickets = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/support/tickets`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setTickets(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateTicket = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/support/ticket`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        fetchTickets();
        handleSelectTicket(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectTicket = async (ticket) => {
    setActiveTicket(ticket);
    try {
      const res = await fetch(`${API_BASE_URL}/api/support/messages/${ticket.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setChatMessages(data);
        setTimeout(() => {
          chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput && !chatAttachment) return;

    setChatLoading(true);

    try {
      let base64Attachment = null;
      if (chatAttachment) {
        base64Attachment = await fileToBase64(chatAttachment);
      }

      const res = await fetch(`${API_BASE_URL}/api/support/message`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          ticketId: activeTicket.id,
          message: chatInput,
          attachment: base64Attachment
        })
      });
      const data = await res.json();

      if (res.ok) {
        setChatMessages(prev => [...prev, data]);
        setChatInput('');
        setChatAttachment(null);
        if (fileInputRef.current) fileInputRef.current.value = '';

        if (socketRef.current) {
          socketRef.current.emit('send_message', {
            ...data,
            ticketUserId: user.id
          });
        }

        setTimeout(() => {
          chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col font-sans select-none">
      {/* Header */}
      <header className="bg-zinc-900/50 border-b border-zinc-900/80 px-8 py-4 flex items-center justify-between sticky top-0 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/10">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-wide">VEXEL AI</h1>
            <p className="text-[10px] text-zinc-400 font-medium">Workstation Panel</p>
          </div>
        </div>

        <nav className="flex items-center gap-1.5">
          <button
            id="btn-nav-generate"
            onClick={() => setActiveTab('generate')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'generate' ? 'bg-violet-600 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" /> Workspace
          </button>
          <button
            id="btn-nav-billing"
            onClick={() => setActiveTab('billing')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'billing' ? 'bg-violet-600 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5" /> Offers & Credits
          </button>
          <button
            id="btn-nav-support"
            onClick={() => setActiveTab('support')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'support' ? 'bg-violet-600 text-white font-bold' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" /> Help Center
          </button>
        </nav>

        <div className="flex items-center gap-5">
          {profile && (
            <div className="flex items-center gap-2.5 bg-zinc-950 px-3.5 py-1.5 border border-zinc-850 rounded-full">
              <Wallet className="w-4 h-4 text-violet-400" />
              <div className="text-right">
                <div className="text-[10px] text-zinc-500 font-medium">Credit Balance</div>
                <div className="text-xs font-bold text-white font-mono">{profile.wallet.credits} Credits</div>
              </div>
            </div>
          )}

          <div className="h-6 w-px bg-zinc-800" />

          <button
            id="btn-user-logout"
            onClick={onLogout}
            className="p-2 border border-zinc-850 hover:border-rose-900/50 hover:bg-rose-950/20 text-zinc-400 hover:text-rose-400 rounded-xl transition-all"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex-1 p-8 overflow-y-auto max-w-7xl mx-auto w-full">
        <AnimatePresence mode="wait">
          {/* WORKSPACE TAB */}
          {activeTab === 'generate' && (
            <motion.div
              key="generateTab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              {/* Controls Column */}
              <div className="lg:col-span-4 space-y-6">
                <div className="p-6 bg-zinc-900/40 border border-zinc-900/80 rounded-2xl glass-card space-y-5">
                  <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-400" /> Upload Product
                  </h2>

                  {/* Drag and Drop Product Panel */}
                  <div className="space-y-2">
                    <div className="relative group border-2 border-dashed border-zinc-800 hover:border-violet-500/50 rounded-xl overflow-hidden bg-zinc-950 flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all">
                      <input
                        id="file-product-upload"
                        type="file"
                        accept="image/png"
                        onChange={handleProductUpload}
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      />
                      
                      {productPreview ? (
                        <div className="relative w-full aspect-square max-w-[160px] rounded-lg overflow-hidden border border-zinc-850 bg-zinc-900 flex items-center justify-center">
                          <img src={productPreview} alt="Product Preview" className="max-h-[140px] max-w-[140px] object-contain" />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="mx-auto w-10 h-10 rounded-lg bg-zinc-900 flex items-center justify-center border border-zinc-800 group-hover:border-violet-500/30 group-hover:bg-violet-600/10 transition-all">
                            <Upload className="w-5 h-5 text-zinc-400 group-hover:text-violet-400" />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-zinc-300">Click or drag product PNG</p>
                            <p className="text-[10px] text-zinc-500">Max 5MB • 1000x1000px preferred</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {errorMsg && (
                      <div className="p-3 bg-rose-950/20 border border-rose-900/40 rounded-lg flex items-start gap-2 text-[11px] text-rose-400">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0 mt-0.5" />
                        <span>{errorMsg}</span>
                      </div>
                    )}
                  </div>

                  {/* Background Only Switch */}
                  <label className="flex items-center gap-3 cursor-pointer py-1 select-none">
                    <input
                      id="chk-background-only"
                      type="checkbox"
                      checked={changeBgOnly}
                      onChange={(e) => setChangeBgOnly(e.target.checked)}
                      className="w-4.5 h-4.5 accent-violet-600 rounded cursor-pointer"
                    />
                    <div>
                      <div className="text-xs text-zinc-200 font-semibold">✓ Change Background Only</div>
                      <div className="text-[10px] text-zinc-500">Keep foreground product 100% pixel-perfect</div>
                    </div>
                  </label>

                  {/* Image Generation Counts */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-zinc-400 font-semibold">Number of Generated Images</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[4, 6, 8].map(num => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setImageCount(num)}
                          className={`py-2 rounded-xl text-xs font-mono font-bold border transition ${
                            imageCount === num 
                              ? 'bg-violet-600/10 border-violet-500 text-violet-400' 
                              : 'bg-zinc-950 border-zinc-850 text-zinc-400 hover:border-zinc-700'
                          }`}
                        >
                          {num} Images
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    id="btn-generate-images"
                    onClick={handleGenerate}
                    disabled={isGenerating || !productFile}
                    className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:pointer-events-none active:scale-95 font-semibold text-white transition flex items-center justify-center gap-2 shadow-lg shadow-violet-600/30"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Generating...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 fill-current" /> Generate Backgrounds ({imageCount * 2} Credits)
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Outputs Column */}
              <div className="lg:col-span-8 space-y-6">
                <div className="p-6 bg-zinc-900/40 border border-zinc-900/80 rounded-2xl glass-card min-h-[500px] flex flex-col justify-between">
                  <div>
                    {/* Toolbar */}
                    <div className="flex justify-between items-center pb-4 border-b border-zinc-900">
                      <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-violet-400" /> Generated Advertisements
                      </h2>

                      {generatedImages.length > 0 && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={downloadAllSelectedZip}
                            disabled={selectedImages.length === 0}
                            className="px-3.5 py-1.5 bg-zinc-900 border border-zinc-850 hover:border-zinc-700 disabled:opacity-40 disabled:pointer-events-none rounded-xl text-xs text-zinc-300 font-medium flex items-center gap-1.5 transition"
                          >
                            <Archive className="w-3.5 h-3.5 text-violet-400" /> Download ZIP
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Loader view */}
                    {isGenerating && (
                      <div className="flex flex-col items-center justify-center py-20 space-y-6">
                        <div className="relative flex items-center justify-center w-24 h-24">
                          <div className="absolute inset-0 rounded-full border-4 border-zinc-800 border-t-violet-600 animate-spin" />
                          <Sparkles className="w-8 h-8 text-violet-500 animate-pulse-glow" />
                        </div>
                        <div className="space-y-2 text-center">
                          <h4 className="text-sm font-bold text-white tracking-wider animate-pulse">AI is generating...</h4>
                          <p className="text-xs text-zinc-500 font-mono">{generationQueue}</p>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-64 h-2 bg-zinc-950 rounded-full border border-zinc-850/50 p-0.5 overflow-hidden">
                          <div 
                            className="h-full bg-violet-600 rounded-full shadow" 
                            style={{ width: `${generationProgress}%`, transition: 'width 0.4s ease' }} 
                          />
                        </div>
                      </div>
                    )}

                    {/* Image Grid view */}
                    {!isGenerating && generatedImages.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-6 pt-6">
                        {generatedImages.map((url, idx) => {
                          const isSelected = selectedImages.includes(url);
                          return (
                            <div 
                              key={idx}
                              onClick={() => toggleImageSelect(url)}
                              className={`relative group aspect-square rounded-xl overflow-hidden border cursor-pointer bg-zinc-950 transition ${
                                isSelected ? 'border-violet-500 shadow-md shadow-violet-500/10' : 'border-zinc-850 hover:border-zinc-700'
                              }`}
                            >
                              <img src={url} alt={`Generated Advertisement ${idx + 1}`} className="w-full h-full object-cover" />
                              
                              <div className="absolute top-2.5 right-2.5 z-10 w-5.5 h-5.5 rounded-full border border-white/20 flex items-center justify-center bg-black/40 backdrop-blur">
                                <div className={`w-3.5 h-3.5 rounded-full transition-all ${isSelected ? 'bg-violet-500 scale-100' : 'scale-0'}`} />
                              </div>

                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 opacity-0 group-hover:opacity-100 transition duration-200 flex items-center justify-between">
                                <span className="text-[10px] text-zinc-300 font-semibold font-mono">Image {idx + 1}</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    downloadSingle(url);
                                  }}
                                  className="p-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 hover:text-white rounded-lg text-zinc-400 transition"
                                  title="Download"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Empty state */}
                    {!isGenerating && generatedImages.length === 0 && (
                      <div className="py-24 text-center space-y-3">
                        <div className="mx-auto w-12 h-12 rounded-xl bg-zinc-900/50 border border-zinc-850 flex items-center justify-center text-zinc-500">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-semibold text-zinc-300">Generate Ad backgrounds</h4>
                          <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                            Upload a product PNG and hit generate to see results.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {generatedImages.length > 0 && !isGenerating && (
                    <div className="text-[10px] text-zinc-500 pt-6 border-t border-zinc-900 mt-6 flex justify-between">
                      <span>Click images to select them for ZIP archiving download.</span>
                      <span>Total: {generatedImages.length} images generated</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* OFFERS & CREDITS TAB */}
          {activeTab === 'billing' && (
            <motion.div
              key="billingTab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {offerProgress && offerState && (
                <div className="p-6 bg-gradient-to-r from-zinc-900/40 via-violet-950/10 to-zinc-900/40 border border-zinc-900 rounded-2xl glass-card space-y-5">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 fill-current" /> Active Rewards Engine
                      </span>
                      <h2 className="text-lg font-bold text-white">Evergreen Discount Loop Progress</h2>
                    </div>

                    {offerState.isActive ? (
                      <div className="px-3.5 py-1.5 bg-violet-600/10 border border-violet-500/20 text-violet-400 rounded-full text-xs font-mono font-bold flex items-center gap-2 animate-pulse-glow">
                        <Clock className="w-3.5 h-3.5" /> Ends in: {timeText}
                      </div>
                    ) : !offerState.nextStart ? (
                      <div className="px-3.5 py-1.5 bg-violet-950/20 border border-violet-900/40 text-violet-400 rounded-xl text-xs font-bold animate-pulse-glow">
                        ★ Purchase any plan to unlock recurring 50%–60% OFF offers!
                      </div>
                    ) : (
                      <div className="px-3.5 py-1.5 bg-zinc-950 border border-zinc-850 text-zinc-500 rounded-full text-xs font-mono font-medium">
                        Offer Opens on Schedule
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-5 gap-3 pt-2">
                    {Array.from({ length: offerProgress.totalRounds }).map((_, idx) => {
                      const roundNum = idx + 1;
                      const isCompleted = roundNum < offerProgress.currentRound;
                      const isCurrent = roundNum === offerProgress.currentRound;
                      return (
                        <div 
                          key={roundNum}
                          className={`p-3.5 rounded-xl border text-center relative overflow-hidden transition-all ${
                            isCompleted 
                              ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' 
                              : isCurrent 
                                ? 'bg-violet-600/5 border-violet-500/30 text-violet-400 ring-1 ring-violet-500/20' 
                                : 'bg-zinc-950/40 border-zinc-900 text-zinc-600'
                          }`}
                        >
                          <div className="text-[10px] font-bold uppercase tracking-wider">Round {roundNum}</div>
                          <div className="text-xl font-extrabold mt-1.5">
                            {roundNum === 5 ? '85%' : '80%'}
                          </div>
                          <div className="text-[8px] mt-1 font-semibold">Reward Lock</div>
                          {isCompleted && (
                            <div className="absolute top-1.5 right-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-2 pt-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-zinc-400 font-medium">
                        Round {offerProgress.currentRound} Progress: <span className="text-white font-bold font-mono">{offerProgress.purchasesInCurrentRound}</span> / {offerProgress.purchasesRequired} Purchases
                      </span>
                      <span className="text-violet-400 font-bold">
                        {offerProgress.isSpecialRewardUnlocked 
                          ? `Reward Unlocked! Next buy: ${offerProgress.nextDiscountPercent}% OFF`
                          : `Next Reward: ${offerProgress.currentRound === 5 ? '85%' : '80%'} OFF`}
                      </span>
                    </div>

                    <div className="w-full h-3 bg-zinc-950 border border-zinc-850/50 rounded-full p-0.5 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 bg-gradient-to-r ${
                          offerProgress.isSpecialRewardUnlocked 
                            ? 'from-emerald-500 to-teal-400 shadow-lg shadow-emerald-500/20' 
                            : 'from-violet-600 to-indigo-500 shadow-lg shadow-violet-500/20'
                        }`}
                        style={{ width: `${(offerProgress.purchasesInCurrentRound / offerProgress.purchasesRequired) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-5">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-violet-400" /> Choose Pricing Plan
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {plans.map((plan) => {
                      const isOfferApplied = plan.isOfferApplied && offerState && offerState.isActive;
                      return (
                        <div 
                          key={plan.id}
                          className={`p-6 rounded-2xl border bg-zinc-900/40 relative flex flex-col justify-between glass-card transition-all ${
                            isOfferApplied ? 'border-violet-500/20 ring-1 ring-violet-500/10' : 'border-zinc-900'
                          }`}
                        >
                          {isOfferApplied && (
                            <div className="absolute top-3.5 right-3.5 bg-violet-600 text-white font-mono font-bold text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                              -{plan.discountPercent}% OFF
                            </div>
                          )}

                          <div className="space-y-4">
                            <div>
                              <h4 className="text-sm font-bold text-white">{plan.name}</h4>
                              <p className="text-xs text-zinc-500 font-medium">Credits Top Up Pack</p>
                            </div>
                            
                            <div className="text-3xl font-extrabold text-white tracking-tight font-mono">
                              {plan.credits.toLocaleString()} <span className="text-sm font-semibold text-zinc-400">Credits</span>
                            </div>

                            <div className="flex items-baseline gap-2 pt-2 border-t border-zinc-900">
                              {isOfferApplied ? (
                                <>
                                  <span className="text-2xl font-black text-white font-mono">₹{plan.discountedPrice}</span>
                                  <span className="text-xs text-zinc-500 line-through font-mono">₹{plan.originalPrice}</span>
                                </>
                              ) : (
                                <span className="text-2xl font-black text-white font-mono">₹{plan.price}</span>
                              )}
                            </div>
                          </div>

                          <button
                            id={`btn-buy-plan-${plan.id}`}
                            onClick={() => handleBuyPlan(plan.id)}
                            disabled={paymentLoading}
                            className="w-full mt-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 active:scale-95 text-xs font-semibold text-white transition flex items-center justify-center gap-1.5 shadow shadow-violet-600/20"
                          >
                            {paymentLoading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                Purchase Pack <ChevronRight className="w-3.5 h-3.5" />
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="lg:col-span-4 space-y-5">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-violet-400" /> Invoices & Billing
                  </h3>

                  <div className="bg-zinc-900/40 border border-zinc-900/80 rounded-2xl p-5 glass-card min-h-[300px] flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Recent Transactions</div>
                      
                      {invoiceHistory.length > 0 ? (
                        <div className="space-y-3.5 max-h-[250px] overflow-y-auto pr-1">
                          {invoiceHistory.map((invoice) => (
                            <div key={invoice.id} className="flex justify-between items-center text-xs p-2 bg-zinc-950 rounded-lg border border-zinc-900">
                              <div className="space-y-1">
                                <div className="font-semibold text-zinc-200 font-mono">+{invoice.credits} Credits</div>
                                <div className="text-[10px] text-zinc-500">{new Date(invoice.createdAt).toLocaleDateString()}</div>
                              </div>
                              <button
                                onClick={() => downloadSingle(`${API_BASE_URL}/api/payments/invoice/${invoice.id}`)}
                                className="p-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white rounded-lg transition"
                                title="Download PDF Invoice"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-12 text-center text-zinc-650 text-xs">
                          No transactions found
                        </div>
                      )}
                    </div>

                    <div className="text-[9px] text-zinc-500 pt-4 border-t border-zinc-900 mt-4 leading-relaxed">
                      All invoices are stored in PDF format inside your local installation storage folder.
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* HELP CENTER TAB */}
          {activeTab === 'support' && (
            <motion.div
              key="supportTab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              <div className="lg:col-span-4 space-y-5">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-violet-400" /> Active Tickets
                  </h3>
                  <button
                    id="btn-create-ticket"
                    onClick={handleCreateTicket}
                    className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 font-semibold text-xs text-white transition-all shadow"
                  >
                    Open New Ticket
                  </button>
                </div>

                <div className="p-5 bg-zinc-900/40 border border-zinc-900/80 rounded-2xl glass-card h-[450px] overflow-y-auto space-y-3">
                  {tickets.length > 0 ? (
                    tickets.map((ticket) => {
                      const isActive = activeTicket && activeTicket.id === ticket.id;
                      return (
                        <div
                          key={ticket.id}
                          onClick={() => handleSelectTicket(ticket)}
                          className={`p-3.5 rounded-xl border cursor-pointer transition ${
                            isActive 
                              ? 'bg-violet-600/10 border-violet-500 text-violet-400' 
                              : 'bg-zinc-950 border-zinc-900 hover:border-zinc-800 text-zinc-400'
                          }`}
                        >
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold font-mono">Ticket #{ticket.id.slice(0, 6)}</span>
                            <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                              ticket.status === 'OPEN' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
                            }`}>
                              {ticket.status}
                            </span>
                          </div>
                          <div className="text-[10px] text-zinc-500 mt-2">
                            Updated: {new Date(ticket.updatedAt).toLocaleString()}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-24 text-center text-zinc-650 text-xs">
                      No active support tickets. Click Open New Ticket to start.
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-8 space-y-5">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-violet-400" /> Support Live Chat
                </h3>

                <div className="p-6 bg-zinc-900/40 border border-zinc-900/80 rounded-2xl glass-card h-[500px] flex flex-col justify-between">
                  {activeTicket ? (
                    <>
                      <div className="pb-3 border-b border-zinc-900 flex justify-between items-center text-xs">
                        <span className="font-semibold text-zinc-300">Active Thread: <span className="font-mono text-zinc-400">#{activeTicket.id}</span></span>
                        <span className={`w-2.5 h-2.5 rounded-full ${activeTicket.status === 'OPEN' ? 'bg-emerald-500' : 'bg-zinc-600 animate-pulse'}`} />
                      </div>

                      <div className="flex-1 my-4 overflow-y-auto pr-1 space-y-3.5">
                        {chatMessages.map((msg, idx) => {
                          const isMe = msg.senderId === user.id;
                          return (
                            <div 
                              key={idx}
                              className={`flex flex-col max-w-[70%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                            >
                              <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                                isMe 
                                  ? 'bg-violet-600 text-white rounded-tr-none' 
                                  : 'bg-zinc-950 border border-zinc-900 text-zinc-300 rounded-tl-none'
                              }`}>
                                {msg.message}

                                {msg.attachmentPath && (
                                  <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center gap-2">
                                    <button
                                      onClick={() => downloadSingle(`http://localhost:3001${msg.attachmentPath}`)}
                                      className="text-[10px] text-violet-200 hover:text-white flex items-center gap-1 transition"
                                    >
                                      <Paperclip className="w-3.5 h-3.5" /> Attachment View
                                    </button>
                                  </div>
                                )}
                              </div>
                              <span className="text-[8px] text-zinc-600 mt-1 font-mono">{new Date(msg.createdAt).toLocaleTimeString()}</span>
                            </div>
                          );
                        })}
                        <div ref={chatBottomRef} />
                      </div>

                      <form onSubmit={handleSendMessage} className="pt-3 border-t border-zinc-900 flex gap-2 items-center">
                        <input
                          id="file-support-attachment"
                          type="file"
                          ref={fileInputRef}
                          onChange={(e) => setChatAttachment(e.target.files[0])}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className={`p-2 rounded-xl border border-zinc-850 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition ${
                            chatAttachment ? 'bg-violet-600/10 border-violet-500 text-violet-400' : ''
                          }`}
                          title="Attach screenshot/logs (Max 10MB)"
                        >
                          <Paperclip className="w-4 h-4" />
                        </button>
                        
                        <input
                          id="txt-support-message-input"
                          type="text"
                          placeholder="Type support query message..."
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          className="flex-1 bg-zinc-950 text-xs glass-input"
                        />

                        <button
                          id="btn-support-message-send"
                          type="submit"
                          disabled={chatLoading || (!chatInput && !chatAttachment)}
                          className="p-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 active:scale-95 disabled:opacity-40 disabled:pointer-events-none text-white transition"
                        >
                          {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 fill-current" />}
                        </button>
                      </form>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center text-zinc-650 text-xs">
                      Select or create a support ticket from the side list to begin live messaging with the technical team.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
