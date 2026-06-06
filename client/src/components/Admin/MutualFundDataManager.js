import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  LinearProgress,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Switch,
  FormControlLabel,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Sync as SyncIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
  Storage as StorageIcon
} from '@mui/icons-material';
import { collection, addDoc, updateDoc, doc, getDocs, query, where, serverTimestamp, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase/firebase';

const MutualFundDataManager = () => {
  const [tabValue, setTabValue] = useState(0);
  const [apiConfigs, setApiConfigs] = useState([]);
  const [syncLogs, setSyncLogs] = useState([]);
  const [fundsData, setFundsData] = useState([]);
  
  // API Configuration State
  const [showApiDialog, setShowApiDialog] = useState(false);
  const [currentApiConfig, setCurrentApiConfig] = useState({
    name: '',
    description: '',
    apiType: 'mfapi', // 'mfapi', 'custom', 'api-ninjas'
    baseUrl: '',
    navUpdateUrl: 'https://api.mfapi.in/mf', // URL for NAV updates
    terUpdateUrl: '', // URL for TER updates (to be configured)
    apiKey: '',
    httpMethod: 'GET', // 'GET', 'POST', 'PUT', 'DELETE'
    authType: 'none', // 'none', 'header', 'query', 'bearer'
    authHeaderName: 'X-Api-Key', // Header name for API key (if authType = 'header')
    authQueryParam: 'api_key', // Query param name for API key (if authType = 'query')
    headers: {},
    responseMapping: {},
    isActive: true
  });
  const [editingApiId, setEditingApiId] = useState(null);

  // Sync State
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState('');
  const [syncResults, setSyncResults] = useState({ added: 0, updated: 0, errors: 0 });
  const [syncError, setSyncError] = useState('');
  
  // Use ref to track results synchronously (accessible in error handlers)
  const syncResultsRef = useRef({ added: 0, updated: 0, errors: 0 });

  // Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedApi, setSelectedApi] = useState('');

  const [message, setMessage] = useState({ type: '', text: '' });
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [totalFunds, setTotalFunds] = useState(0);

  // Job Tracking State
  const [activeJob, setActiveJob] = useState(null); // { type: 'nav' | 'everything', startTime, processed: 0, total: 0 }
  const [jobProgress, setJobProgress] = useState(0);
  const [jobStatus, setJobStatus] = useState('');
  const [jobTimer, setJobTimer] = useState(0); // Elapsed seconds
  const [jobHistory, setJobHistory] = useState([]);
  const [jobPaused, setJobPaused] = useState(false);
  const [jobCancelled, setJobCancelled] = useState(false);
  const jobTimerRef = useRef(null);
  const activeJobRef = useRef(null);

  // Load API configurations (only configs and logs on mount, NOT all funds data)
  useEffect(() => {
    loadApiConfigurations();
    loadSyncLogs();
    loadTotalCount();
    loadJobHistory();
  }, []);

  // Load funds data only when DB View tab is active
  useEffect(() => {
    if (tabValue === 3 && !dataLoaded && !loadingData) {
      loadFundsData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabValue, dataLoaded, loadingData]);

  const loadApiConfigurations = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'mf_api_configurations'));
      const configs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setApiConfigs(configs);
    } catch (error) {
      console.error('Error loading API configs:', error);
      setMessage({ type: 'error', text: 'Failed to load API configurations' });
    }
  };

  const loadSyncLogs = async () => {
    try {
      const snapshot = await getDocs(
        query(collection(db, 'mf_sync_logs'), where('timestamp', '>', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))
      );
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => b.timestamp?.toMillis() - a.timestamp?.toMillis());
      setSyncLogs(logs);
    } catch (error) {
      console.error('Error loading sync logs:', error);
    }
  };

  const loadTotalCount = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'mutual_funds'));
      setTotalFunds(snapshot.size);
    } catch (error) {
      console.error('Error loading total count:', error);
    }
  };

  const loadJobHistory = async () => {
    try {
      const snapshot = await getDocs(
        query(
          collection(db, 'mf_sync_jobs'),
          where('startTime', '>', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) // Last 30 days
        )
      );
      const jobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => b.startTime?.toMillis() - a.startTime?.toMillis())
        .slice(0, 20); // Keep last 20 jobs
      setJobHistory(jobs);
    } catch (error) {
      console.error('Error loading job history:', error);
    }
  };

  // Job Management Utilities
  const startJobTimer = () => {
    setJobTimer(0);
    if (jobTimerRef.current) clearInterval(jobTimerRef.current);
    jobTimerRef.current = setInterval(() => {
      setJobTimer(prev => prev + 1);
    }, 1000);
  };

  const stopJobTimer = () => {
    if (jobTimerRef.current) {
      clearInterval(jobTimerRef.current);
      jobTimerRef.current = null;
    }
  };

  const pauseJobTimer = () => {
    if (jobTimerRef.current) {
      clearInterval(jobTimerRef.current);
      jobTimerRef.current = null;
    }
  };

  const resumeJobTimer = () => {
    if (!jobTimerRef.current) {
      jobTimerRef.current = setInterval(() => {
        setJobTimer(prev => prev + 1);
      }, 1000);
    }
  };

  const pauseJob = () => {
    setJobPaused(true);
    pauseJobTimer();
    setJobStatus('Job paused by user...');
  };

  const resumeJob = () => {
    setJobPaused(false);
    resumeJobTimer();
    setJobStatus('Job resumed...');
  };

  const cancelJob = () => {
    if (window.confirm('Are you sure you want to cancel this job?')) {
      setJobCancelled(true);
      stopJobTimer();
      setJobStatus('Job cancelled by user');
      
      // Save cancelled job to history
      saveJobToHistory({
        type: activeJobRef.current?.type === 'nav' ? 'nav_update' : 'full_sync',
        status: 'cancelled',
        processed: activeJobRef.current?.processed || 0,
        totalFunds: activeJobRef.current?.total || 0,
        duration: jobTimer,
        startTime: activeJobRef.current?.startTime || new Date()
      });

      setTimeout(() => {
        setActiveJob(null);
        activeJobRef.current = null;
        setJobProgress(0);
        setJobStatus('');
        setJobPaused(false);
        setJobCancelled(false);
      }, 2000);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const saveJobToHistory = async (jobData) => {
    try {
      await addDoc(collection(db, 'mf_sync_jobs'), {
        ...jobData,
        startTime: jobData.startTime || serverTimestamp(),
        endTime: serverTimestamp()
      });
      loadJobHistory(); // Reload history
    } catch (error) {
      console.error('Error saving job history:', error);
    }
  };

  const loadFundsData = async (searchQuery = '') => {
    if (loadingData) return;
    
    setLoadingData(true);
    try {
      if (searchQuery.trim()) {
        // Search by scheme name or code
        const searchLower = searchQuery.toLowerCase();
        const snapshot = await getDocs(collection(db, 'mutual_funds'));
        const funds = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(fund => 
            fund.schemeName?.toLowerCase().includes(searchLower) ||
            fund.schemeCode?.toString().includes(searchQuery)
          )
          .slice(0, 500); // Limit search results
        setFundsData(funds);
      } else {
        // Load 10 random records by default
        const snapshot = await getDocs(
          query(
            collection(db, 'mutual_funds'),
            where('isActive', '==', true)
          )
        );
        const allFunds = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Select 10 random funds
        const randomFunds = [];
        const totalAvailable = allFunds.length;
        const samplesToTake = Math.min(10, totalAvailable);
        
        if (samplesToTake > 0) {
          const usedIndices = new Set();
          while (randomFunds.length < samplesToTake) {
            const randomIndex = Math.floor(Math.random() * totalAvailable);
            if (!usedIndices.has(randomIndex)) {
              randomFunds.push(allFunds[randomIndex]);
              usedIndices.add(randomIndex);
            }
          }
        }
        
        setFundsData(randomFunds);
      }
      
      setDataLoaded(true);
    } catch (error) {
      console.error('Error loading funds:', error);
      setMessage({ type: 'error', text: 'Failed to load mutual funds data' });
    } finally {
      setLoadingData(false);
    }
  };

  // API Configuration Handlers
  const handleSaveApiConfig = async () => {
    try {
      const configData = {
        ...currentApiConfig,
        updatedAt: serverTimestamp()
      };

      if (editingApiId) {
        await updateDoc(doc(db, 'mf_api_configurations', editingApiId), configData);
        setMessage({ type: 'success', text: 'API configuration updated successfully' });
      } else {
        configData.createdAt = serverTimestamp();
        await addDoc(collection(db, 'mf_api_configurations'), configData);
        setMessage({ type: 'success', text: 'API configuration added successfully' });
      }

      setShowApiDialog(false);
      resetApiForm();
      loadApiConfigurations();
    } catch (error) {
      console.error('Error saving API config:', error);
      setMessage({ type: 'error', text: 'Failed to save API configuration' });
    }
  };

  const handleEditApiConfig = (config) => {
    setCurrentApiConfig(config);
    setEditingApiId(config.id);
    setShowApiDialog(true);
  };

  const handleDeleteApiConfig = async (configId) => {
    if (window.confirm('Are you sure you want to delete this API configuration?')) {
      try {
        await deleteDoc(doc(db, 'mf_api_configurations', configId));
        setMessage({ type: 'success', text: 'API configuration deleted' });
        loadApiConfigurations();
      } catch (error) {
        console.error('Error deleting API config:', error);
        setMessage({ type: 'error', text: 'Failed to delete API configuration' });
      }
    }
  };

  const resetApiForm = () => {
    setCurrentApiConfig({
      name: '',
      description: '',
      apiType: 'mfapi',
      baseUrl: '',
      apiKey: '',
      httpMethod: 'GET',
      authType: 'none',
      authHeaderName: 'X-Api-Key',
      authQueryParam: 'api_key',
      headers: {},
      responseMapping: {},
      isActive: true
    });
    setEditingApiId(null);
  };

  // Data Sync Handlers
  const handleSyncData = async () => {
    if (!selectedApi) {
      setMessage({ type: 'error', text: 'Please select an API configuration first' });
      return;
    }

    const config = apiConfigs.find(c => c.id === selectedApi);
    if (!config) {
      setMessage({ type: 'error', text: 'Invalid API configuration' });
      return;
    }

    // TEMPORARILY DISABLED: Check if sync was already done today (once per day restriction)
    // TODO: Re-enable after testing sync functionality
    /*
    const lastSync = syncLogs.find(log => 
      log.apiConfigId === config.id && 
      log.status === 'completed' &&
      log.timestamp?.toDate() > new Date(Date.now() - 24 * 60 * 60 * 1000)
    );
    
    if (lastSync) {
      const lastSyncTime = lastSync.timestamp.toDate().toLocaleString();
      setMessage({ 
        type: 'warning', 
        text: `Sync already completed today at ${lastSyncTime}. Please wait 24 hours before syncing again.` 
      });
      return;
    }
    */

    setSyncing(true);
    setSyncProgress(0);
    setSyncStatus('Initializing sync...');
    setSyncResults({ added: 0, updated: 0, errors: 0 });
    syncResultsRef.current = { added: 0, updated: 0, errors: 0 };
    setSyncError('');

    const logId = await createSyncLog(config, 'started');

    try {
      if (config.apiType === 'mfapi') {
        const finalResults = await syncFromMFApi(config, logId);
        syncResultsRef.current = finalResults; // Ensure ref has final results
      } else {
        throw new Error('Unsupported API type');
      }

      await updateSyncLog(logId, 'completed', syncResultsRef.current);
      setMessage({ type: 'success', text: `Sync completed! Added: ${syncResultsRef.current.added}, Updated: ${syncResultsRef.current.updated}` });
    } catch (error) {
      console.error('Sync error:', error);
      
      // Build detailed error message
      let errorDetails = error.message || 'Unknown error occurred';
      
      // Check for specific error types
      if (error.message.includes('403')) {
        errorDetails = `Access Denied (403 Forbidden)\n\n`;
        errorDetails += `The CORS proxy service denied your request.\n\n`;
        errorDetails += `If you're using cors-anywhere.herokuapp.com:\n`;
        errorDetails += `1. This free service requires you to request temporary access\n`;
        errorDetails += `2. Visit: https://cors-anywhere.herokuapp.com/corsdemo\n`;
        errorDetails += `3. Click "Request temporary access to the demo server"\n`;
        errorDetails += `4. Access is granted for a limited time only\n\n`;
        errorDetails += `Better Solutions:\n`;
        errorDetails += `- Create a Firebase Cloud Function to proxy API requests\n`;
        errorDetails += `- Set up your own backend server\n`;
        errorDetails += `- Use a different CORS proxy (search for "cors proxy service")\n\n`;
        errorDetails += `Original error: ${error.message}`;
      } else if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
        errorDetails = `Network/CORS Error: Cannot reach the API at '${config.baseUrl}'\n\n`;
        errorDetails += `This typically happens because:\n`;
        errorDetails += `1. The API doesn't allow browser requests (CORS policy)\n`;
        errorDetails += `2. Network connectivity issues\n`;
        errorDetails += `3. The API endpoint is incorrect\n\n`;
        errorDetails += `Solutions:\n`;
        errorDetails += `- Use a backend server or Firebase Cloud Function to proxy requests\n`;
        errorDetails += `- Try a CORS proxy (with limitations - see warning above)\n`;
        errorDetails += `- Deploy to production domain (CORS often allows production)\n\n`;
        errorDetails += `Original error: ${error.message}`;
      } else if (error.message.includes('404')) {
        errorDetails = `API Endpoint Not Found (404)\n\n`;
        errorDetails += `The URL '${config.baseUrl}' doesn't exist.\n\n`;
        errorDetails += `Please verify:\n`;
        errorDetails += `- The base URL is correct\n`;
        errorDetails += `- The API endpoint path is accurate\n`;
        errorDetails += `- The API service is currently available\n\n`;
        errorDetails += `Original error: ${error.message}`;
      } else if (error.message.includes('500') || error.message.includes('502') || error.message.includes('503')) {
        errorDetails = `Server Error: The API server is having issues\n\n`;
        errorDetails += `The server returned: ${error.message}\n\n`;
        errorDetails += `This is a temporary issue with the API provider.\n`;
        errorDetails += `Please try again later.\n`;
      }
      
      setSyncError(errorDetails);
      await updateSyncLog(logId, 'failed', syncResultsRef.current, errorDetails);
      setMessage({ type: 'error', text: `Sync failed: ${error.message}` });
    } finally {
      setSyncing(false);
      setSyncProgress(0);
      setSyncStatus('');
      // Small delay to ensure Firestore update propagates before reloading
      setTimeout(() => {
        loadSyncLogs();
        loadTotalCount(); // Only reload count, not all data
        // If user is on DB View tab, reload the visible data
        if (tabValue === 2 && dataLoaded) {
          loadFundsData(searchTerm);
        }
      }, 500);
    }
  };

  const syncFromMFApi = async (config, logId) => {
    setSyncStatus('Fetching all mutual funds list from API...');
    
    try {
      // Build request options based on configuration
      const requestOptions = {
        method: config.httpMethod || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers
        }
      };

      // Add authentication based on authType
      if (config.authType === 'header' && config.apiKey) {
        requestOptions.headers[config.authHeaderName || 'X-Api-Key'] = config.apiKey;
      } else if (config.authType === 'bearer' && config.apiKey) {
        requestOptions.headers['Authorization'] = `Bearer ${config.apiKey}`;
      }

      // Build URL with query params if needed
      let apiUrl = config.baseUrl;
      if (config.authType === 'query' && config.apiKey) {
        const separator = apiUrl.includes('?') ? '&' : '?';
        const paramName = config.authQueryParam || 'api_key';
        apiUrl = `${apiUrl}${separator}${paramName}=${encodeURIComponent(config.apiKey)}`;
      }
      
      // Step 1: Fetch all mutual funds from API (saved locally in memory)
      const listResponse = await fetch(apiUrl, requestOptions);
      if (!listResponse.ok) {
        throw new Error(`API request failed: ${listResponse.status} ${listResponse.statusText}`);
      }
      
      const allFunds = await listResponse.json();
      console.log(`Fetched ${allFunds.length} mutual funds from API - data saved locally`);
      
      setSyncStatus(`Loading existing funds from database...`);
      setSyncProgress(3);
      
      // Step 2: Load ALL existing funds from database (single query)
      const existingSnapshot = await getDocs(collection(db, 'mutual_funds'));
      const existingFundsMap = new Map();
      existingSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.schemeCode) {
          existingFundsMap.set(data.schemeCode.toString(), { id: doc.id, ...data });
        }
      });
      console.log(`Loaded ${existingFundsMap.size} existing funds from database`);
      
      setSyncStatus(`Fetching detailed data (ISIN + metadata) for ${allFunds.length} funds...`);
      setSyncProgress(5);
      
      // Step 3: Fetch detailed data for each fund (in parallel batches to avoid overwhelming API)
      const DETAIL_BATCH_SIZE = 50; // Fetch 50 funds details at a time
      const detailBatches = Math.ceil(allFunds.length / DETAIL_BATCH_SIZE);
      const enrichedFunds = [];
      
      for (let dbIndex = 0; dbIndex < detailBatches; dbIndex++) {
        // Check for cancellation
        if (jobCancelled) {
          console.log('Job cancelled by user during detail fetch');
          throw new Error('Job cancelled by user');
        }

        // Check for pause
        while (jobPaused && !jobCancelled) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        const batchFunds = allFunds.slice(dbIndex * DETAIL_BATCH_SIZE, (dbIndex + 1) * DETAIL_BATCH_SIZE);
        
        setSyncStatus(`Fetching details batch ${dbIndex + 1}/${detailBatches} (${batchFunds.length} funds)...`);
        setSyncProgress(5 + ((dbIndex + 1) / detailBatches) * 40);
        
        // Fetch details in parallel for this batch
        const detailPromises = batchFunds.map(async (fund) => {
          try {
            const detailUrl = `${config.baseUrl}/${fund.schemeCode}`;
            const detailResponse = await fetch(detailUrl, requestOptions);
            
            if (!detailResponse.ok) {
              console.warn(`Failed to fetch details for ${fund.schemeCode}: ${detailResponse.status}`);
              return { ...fund, detailsFetched: false };
            }
            
            const detailData = await detailResponse.json();
            
            // Helper function to parse DD-MM-YYYY date
            const parseDate = (dateStr) => {
              if (!dateStr) return null;
              const [day, month, year] = dateStr.split('-');
              return new Date(`${year}-${month}-${day}`);
            };
            
            // Helper function to calculate returns
            const calculateReturns = (currentNav, historicalNav) => {
              if (!currentNav || !historicalNav || historicalNav === 0) return null;
              return (((currentNav - historicalNav) / historicalNav) * 100).toFixed(2);
            };
            
            // Extract NAV data
            let nav = null;
            let navAsOf = null;
            let returns1yr = null;
            let returns3yr = null;
            let returns5yr = null;
            
            if (detailData.data && detailData.data.length > 0) {
              // Latest NAV
              const latestNav = detailData.data[0];
              nav = latestNav.nav ? parseFloat(latestNav.nav) : null;
              navAsOf = latestNav.date || null;
              
              // Calculate returns if we have current NAV
              if (nav) {
                const currentDate = parseDate(navAsOf);
                
                // Find NAV 1 year ago (~365 days)
                const oneYearAgoNav = detailData.data.find((record, index) => {
                  if (!record.date || index === 0) return false;
                  const recordDate = parseDate(record.date);
                  const daysDiff = Math.floor((currentDate - recordDate) / (1000 * 60 * 60 * 24));
                  return daysDiff >= 365 && daysDiff <= 375; // 365-375 days range
                });
                if (oneYearAgoNav && oneYearAgoNav.nav) {
                  returns1yr = calculateReturns(nav, parseFloat(oneYearAgoNav.nav));
                }
                
                // Find NAV 3 years ago (~1095 days)
                const threeYearAgoNav = detailData.data.find((record, index) => {
                  if (!record.date || index === 0) return false;
                  const recordDate = parseDate(record.date);
                  const daysDiff = Math.floor((currentDate - recordDate) / (1000 * 60 * 60 * 24));
                  return daysDiff >= 1095 && daysDiff <= 1105; // 3 years range
                });
                if (threeYearAgoNav && threeYearAgoNav.nav) {
                  returns3yr = calculateReturns(nav, parseFloat(threeYearAgoNav.nav));
                }
                
                // Find NAV 5 years ago (~1825 days)
                const fiveYearAgoNav = detailData.data.find((record, index) => {
                  if (!record.date || index === 0) return false;
                  const recordDate = parseDate(record.date);
                  const daysDiff = Math.floor((currentDate - recordDate) / (1000 * 60 * 60 * 24));
                  return daysDiff >= 1825 && daysDiff <= 1835; // 5 years range
                });
                if (fiveYearAgoNav && fiveYearAgoNav.nav) {
                  returns5yr = calculateReturns(nav, parseFloat(fiveYearAgoNav.nav));
                }
              }
            }
            
            // Extract metadata from response
            return {
              schemeCode: fund.schemeCode,
              schemeName: fund.schemeName,
              detailsFetched: true,
              isinGrowth: detailData.meta?.isin_growth || null,
              isinDivReinvestment: detailData.meta?.isin_div_reinvestment || null,
              fundHouse: detailData.meta?.fund_house || null,
              schemeType: detailData.meta?.scheme_type || null,
              schemeCategory: detailData.meta?.scheme_category || null,
              nav: nav,
              navAsOf: navAsOf,
              returns1yr: returns1yr,
              returns3yr: returns3yr,
              returns5yr: returns5yr,
            };
          } catch (error) {
            console.error(`Error fetching details for ${fund.schemeCode}:`, error);
            return { ...fund, detailsFetched: false };
          }
        });
        
        const batchResults = await Promise.all(detailPromises);
        enrichedFunds.push(...batchResults);
        
        // Small delay between detail batches to avoid rate limiting
        if (dbIndex < detailBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
      
      console.log(`Enriched ${enrichedFunds.filter(f => f.detailsFetched).length}/${allFunds.length} funds with detailed data`);
      
      setSyncStatus(`Saving ${enrichedFunds.length} enriched funds to database...`);
      setSyncProgress(50);
      
      // Step 4: Process enriched funds in Firestore batches of 500
      const BATCH_SIZE = 500;
      const totalBatches = Math.ceil(enrichedFunds.length / BATCH_SIZE);
      let results = { added: 0, updated: 0, errors: 0 };
      
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        // Check for cancellation
        if (jobCancelled) {
          console.log('Job cancelled by user during database save');
          throw new Error('Job cancelled by user');
        }

        // Check for pause
        while (jobPaused && !jobCancelled) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        const batchFunds = enrichedFunds.slice(batchIndex * BATCH_SIZE, (batchIndex + 1) * BATCH_SIZE);
        
        setSyncStatus(`Saving batch ${batchIndex + 1}/${totalBatches} (${batchFunds.length} funds)...`);
        setSyncProgress(50 + ((batchIndex + 1) / totalBatches) * 50);
        
        // Create a new Firestore batch
        const batch = writeBatch(db);
        let batchOps = 0;
        
        for (const fundInfo of batchFunds) {
          try {
            if (!fundInfo.schemeCode) {
              results.errors++;
              continue;
            }
            
            const fundData = {
              // Basic Information
              schemeCode: fundInfo.schemeCode,
              schemeName: fundInfo.schemeName,
              source: config.name || 'Unknown',
              apiType: config.apiType,
              isActive: true,
              lastUpdated: serverTimestamp(),
              
              // ISIN Codes
              isinGrowth: null,
              isinDivReinvestment: null,
              
              // Fund Details
              fundHouse: null,
              schemeType: null,
              schemeCategory: null,
              category: null,
              subCategory: null,
              
              // Investment Minimums
              minSip: null,
              minLumpsum: null,
              
              // Fund Metrics
              expenseRatio: null,
              fundSizeCr: null,
              fundAgeYr: null,
              fundManager: null,
              
              // Risk & Performance Metrics
              sortino: null,
              alpha: null,
              standardDeviation: null,
              beta: null,
              sharpe: null,
              riskLevel: null,
              rating: null,
              
              // Returns
              returns1yr: null,
              returns3yr: null,
              returns5yr: null,
              
              // NAV
              nav: null,
              navAsOf: null,
              
              // TER
              ter: null,
              terAsOf: null
            };
            
            // Add enriched data if details were fetched successfully
            if (fundInfo.detailsFetched) {
              fundData.isinGrowth = fundInfo.isinGrowth;
              fundData.isinDivReinvestment = fundInfo.isinDivReinvestment;
              fundData.fundHouse = fundInfo.fundHouse;
              fundData.schemeType = fundInfo.schemeType;
              fundData.schemeCategory = fundInfo.schemeCategory;
              fundData.nav = fundInfo.nav;
              fundData.navAsOf = fundInfo.navAsOf;
              fundData.returns1yr = fundInfo.returns1yr;
              fundData.returns3yr = fundInfo.returns3yr;
              fundData.returns5yr = fundInfo.returns5yr;
            }
            
            const existingFund = existingFundsMap.get(fundInfo.schemeCode.toString());
            
            if (existingFund) {
              // Update existing fund
              const docRef = doc(db, 'mutual_funds', existingFund.id);
              batch.update(docRef, fundData);
              results.updated++;
            } else {
              // Add new fund
              const newDocRef = doc(collection(db, 'mutual_funds'));
              batch.set(newDocRef, fundData);
              results.added++;
            }
            
            batchOps++;
          } catch (error) {
            console.error(`Error preparing fund ${fundInfo.schemeCode}:`, error);
            results.errors++;
          }
        }
        
        // Commit the batch
        if (batchOps > 0) {
          try {
            await batch.commit();
            console.log(`Batch ${batchIndex + 1}/${totalBatches} committed: ${batchOps} operations`);
          } catch (error) {
            console.error(`Error committing batch ${batchIndex + 1}:`, error);
            results.errors += batchOps;
          }
        }
        
        setSyncResults(results);
        syncResultsRef.current = results; // Keep ref in sync
        
        // Small delay between batches to avoid rate limiting
        if (batchIndex < totalBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      console.log(`Sync completed: Added ${results.added}, Updated ${results.updated}, Errors ${results.errors}`);
      return results;
      
    } catch (error) {
      console.error('MFApi sync error:', error);
      throw error;
    }
  };

  const createSyncLog = async (config, status) => {
    const logData = {
      apiConfigId: config.id,
      apiName: config.name,
      status,
      timestamp: serverTimestamp(),
      results: { added: 0, updated: 0, errors: 0 }
    };
    const docRef = await addDoc(collection(db, 'mf_sync_logs'), logData);
    return docRef.id;
  };

  const updateSyncLog = async (logId, status, results, errorMessage = null) => {
    const updateData = {
      status,
      results,
      completedAt: serverTimestamp()
    };
    if (errorMessage) updateData.errorMessage = errorMessage;
    
    await updateDoc(doc(db, 'mf_sync_logs', logId), updateData);
  };

  // Update NAV Only (for existing funds)
  const updateNavOnly = async () => {
    try {
      // Find active config (preferably MFapi)
      const config = apiConfigs.find(c => c.isActive && c.apiType === 'mfapi') || apiConfigs.find(c => c.isActive);
      if (!config) {
        setMessage({ type: 'error', text: 'No active API configuration found' });
        return;
      }

      // Start job tracking
      setActiveJob({ type: 'nav', startTime: new Date(), processed: 0, total: 0 });
      activeJobRef.current = { type: 'nav', startTime: new Date(), processed: 0, total: 0 };
      setJobProgress(0);
      setJobStatus('Loading existing funds...');
      setJobPaused(false);
      setJobCancelled(false);
      startJobTimer();

      // Load all existing funds
      const existingSnapshot = await getDocs(collection(db, 'mutual_funds'));
      const existingFunds = existingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const totalFunds = existingFunds.length;

      setActiveJob(prev => ({ ...prev, total: totalFunds }));
      activeJobRef.current.total = totalFunds;
      setJobStatus(`Updating NAV for ${totalFunds} funds...`);
      setJobProgress(5);

      // Build request options
      const requestOptions = {
        method: config.httpMethod || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...config.headers
        }
      };

      // Add authentication
      if (config.authType === 'header' && config.apiKey) {
        requestOptions.headers[config.authHeaderName || 'X-Api-Key'] = config.apiKey;
      } else if (config.authType === 'bearer' && config.apiKey) {
        requestOptions.headers['Authorization'] = `Bearer ${config.apiKey}`;
      }

      // NAV update URL (use navUpdateUrl if exists, else baseUrl)
      const navBaseUrl = config.navUpdateUrl || config.baseUrl;

      // Process in batches (50 parallel calls)
      const BATCH_SIZE = 50;
      const totalBatches = Math.ceil(totalFunds / BATCH_SIZE);
      let processed = 0;
      let updated = 0;
      let errors = 0;

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        // Check for cancellation
        if (jobCancelled) {
          console.log('Job cancelled by user');
          return;
        }

        // Check for pause
        while (jobPaused && !jobCancelled) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        const batchFunds = existingFunds.slice(batchIndex * BATCH_SIZE, (batchIndex + 1) * BATCH_SIZE);
        
        setJobStatus(`Batch ${batchIndex + 1}/${totalBatches}: Fetching NAV data...`);
        setJobProgress(5 + ((batchIndex / totalBatches) * 45));

        // Fetch NAV details in parallel
        const navPromises = batchFunds.map(async (fund) => {
          try {
            const detailUrl = `${navBaseUrl}/${fund.schemeCode}`;
            const detailResponse = await fetch(detailUrl, requestOptions);
            
            if (!detailResponse.ok) {
              return { id: fund.id, success: false };
            }
            
            const detailData = await detailResponse.json();
            
            // Parse date helper
            const parseDate = (dateStr) => {
              if (!dateStr) return null;
              const [day, month, year] = dateStr.split('-');
              return new Date(`${year}-${month}-${day}`);
            };
            
            // Calculate returns helper
            const calculateReturns = (currentNav, historicalNav) => {
              if (!currentNav || !historicalNav || historicalNav === 0) return null;
              return (((currentNav - historicalNav) / historicalNav) * 100).toFixed(2);
            };
            
            let nav = null;
            let navAsOf = null;
            let returns1yr = null;
            let returns3yr = null;
            let returns5yr = null;
            
            if (detailData.data && detailData.data.length > 0) {
              const latestNav = detailData.data[0];
              nav = latestNav.nav ? parseFloat(latestNav.nav) : null;
              navAsOf = latestNav.date || null;
              
              if (nav) {
                const currentDate = parseDate(navAsOf);
                
                // 1 year returns
                const oneYearAgoNav = detailData.data.find((record, index) => {
                  if (!record.date || index === 0) return false;
                  const recordDate = parseDate(record.date);
                  const daysDiff = Math.floor((currentDate - recordDate) / (1000 * 60 * 60 * 24));
                  return daysDiff >= 365 && daysDiff <= 375;
                });
                if (oneYearAgoNav && oneYearAgoNav.nav) {
                  returns1yr = calculateReturns(nav, parseFloat(oneYearAgoNav.nav));
                }
                
                // 3 year returns
                const threeYearAgoNav = detailData.data.find((record, index) => {
                  if (!record.date || index === 0) return false;
                  const recordDate = parseDate(record.date);
                  const daysDiff = Math.floor((currentDate - recordDate) / (1000 * 60 * 60 * 24));
                  return daysDiff >= 1095 && daysDiff <= 1105;
                });
                if (threeYearAgoNav && threeYearAgoNav.nav) {
                  returns3yr = calculateReturns(nav, parseFloat(threeYearAgoNav.nav));
                }
                
                // 5 year returns
                const fiveYearAgoNav = detailData.data.find((record, index) => {
                  if (!record.date || index === 0) return false;
                  const recordDate = parseDate(record.date);
                  const daysDiff = Math.floor((currentDate - recordDate) / (1000 * 60 * 60 * 24));
                  return daysDiff >= 1825 && daysDiff <= 1835;
                });
                if (fiveYearAgoNav && fiveYearAgoNav.nav) {
                  returns5yr = calculateReturns(nav, parseFloat(fiveYearAgoNav.nav));
                }
              }
            }
            
            return { id: fund.id, success: true, nav, navAsOf, returns1yr, returns3yr, returns5yr };
          } catch (error) {
            return { id: fund.id, success: false };
          }
        });
        
        const navResults = await Promise.all(navPromises);
        
        // Update Firestore in batch
        setJobStatus(`Batch ${batchIndex + 1}/${totalBatches}: Saving to database...`);
        setJobProgress(50 + ((batchIndex / totalBatches) * 50));
        
        const batch = writeBatch(db);
        let batchOps = 0;
        
        for (const result of navResults) {
          if (result.success && result.nav !== null) {
            const docRef = doc(db, 'mutual_funds', result.id);
            batch.update(docRef, {
              nav: result.nav,
              navAsOf: result.navAsOf,
              returns1yr: result.returns1yr,
              returns3yr: result.returns3yr,
              returns5yr: result.returns5yr,
              lastUpdated: serverTimestamp()
            });
            batchOps++;
            updated++;
          } else if (!result.success) {
            errors++;
          }
          processed++;
        }
        
        if (batchOps > 0) {
          await batch.commit();
        }
        
        setActiveJob(prev => ({ ...prev, processed }));
        activeJobRef.current.processed = processed;
        
        // Small delay between batches
        if (batchIndex < totalBatches - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      // Job complete
      stopJobTimer();
      const duration = jobTimer;
      setJobStatus(`Completed: ${updated} updated, ${errors} errors`);
      setJobProgress(100);
      
      // Save job history
      await saveJobToHistory({
        type: 'nav_update',
        status: 'completed',
        totalFunds,
        processed,
        updated,
        errors,
        duration,
        startTime: activeJobRef.current.startTime
      });

      setMessage({ type: 'success', text: `NAV update completed: ${updated} funds updated` });
      setTimeout(() => {
        setActiveJob(null);
        activeJobRef.current = null;
        setJobProgress(0);
        setJobStatus('');
        setJobPaused(false);
        setJobCancelled(false);
      }, 3000);

    } catch (error) {
      console.error('NAV update error:', error);
      stopJobTimer();
      
      // Don't show error or save history if job was cancelled (already handled)
      if (!jobCancelled) {
        setJobStatus(`Error: ${error.message}`);
        setMessage({ type: 'error', text: `NAV update failed: ${error.message}` });
        
        // Save error to history
        await saveJobToHistory({
          type: 'nav_update',
          status: 'failed',
          error: error.message,
          startTime: activeJobRef.current?.startTime || new Date()
        });
      }
      
      setTimeout(() => {
        setActiveJob(null);
        activeJobRef.current = null;
        setJobCancelled(false);
      }, 3000);
    }
  };

  // Update Everything (full sync with job tracking)
  const updateEverything = async () => {
    try {
      const config = apiConfigs.find(c => c.isActive && c.apiType === 'mfapi') || apiConfigs.find(c => c.isActive);
      if (!config) {
        setMessage({ type: 'error', text: 'No active API configuration found' });
        return;
      }

      // Start job tracking
      setActiveJob({ type: 'everything', startTime: new Date(), processed: 0, total: 0 });
      activeJobRef.current = { type: 'everything', startTime: new Date(), processed: 0, total: 0 };
      setJobProgress(0);
      setJobStatus('Fetching all funds from API...');
      setJobPaused(false);
      setJobCancelled(false);
      startJobTimer();

      // Create sync log
      const logId = await createSyncLog(config, 'in_progress');

      // Use existing syncFromMFApi function (it already has progress tracking)
      setSyncing(true);
      const results = await syncFromMFApi(config, logId);
      
      // Update sync log
      await updateSyncLog(logId, 'completed', results);
      
      // Job complete
      stopJobTimer();
      const duration = jobTimer;
      setJobStatus(`Completed: ${results.added} added, ${results.updated} updated`);
      setJobProgress(100);
      setSyncing(false);

      // Save job history
      await saveJobToHistory({
        type: 'full_sync',
        status: 'completed',
        added: results.added,
        updated: results.updated,
        errors: results.errors,
        duration,
        startTime: activeJobRef.current.startTime
      });

      setMessage({ type: 'success', text: `Full sync completed: ${results.added} added, ${results.updated} updated` });
      
      // Reload data
      loadSyncLogs();
      loadTotalCount();
      
      setTimeout(() => {
        setActiveJob(null);
        activeJobRef.current = null;
        setJobProgress(0);
        setJobStatus('');
        setJobPaused(false);
        setJobCancelled(false);
      }, 3000);

    } catch (error) {
      console.error('Update everything error:', error);
      stopJobTimer();
      setSyncing(false);
      
      // Don't show error or save history if job was cancelled (already handled)
      if (!jobCancelled) {
        setJobStatus(`Error: ${error.message}`);
        setMessage({ type: 'error', text: `Full sync failed: ${error.message}` });
        
        // Save error to history
        await saveJobToHistory({
          type: 'full_sync',
          status: 'failed',
          error: error.message,
          startTime: activeJobRef.current?.startTime || new Date()
        });
      }
      
      setTimeout(() => {
        setActiveJob(null);
        activeJobRef.current = null;
        setJobCancelled(false);
      }, 3000);
    }
  };

  // Render Functions
  const renderApiConfigTab = () => (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h6">API Configurations</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setShowApiDialog(true)}
        >
          Add API Configuration
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>HTTP Method</TableCell>
              <TableCell>Auth Type</TableCell>
              <TableCell>Base URL</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Last Updated</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {apiConfigs.map((config) => (
              <TableRow key={config.id}>
                <TableCell>
                  <Typography variant="body2" fontWeight="bold">{config.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{config.description}</Typography>
                </TableCell>
                <TableCell>
                  <Chip label={config.apiType} size="small" />
                </TableCell>
                <TableCell>
                  <Chip label={config.httpMethod || 'GET'} size="small" color="primary" variant="outlined" />
                </TableCell>
                <TableCell>
                  <Chip 
                    label={config.authType || 'none'} 
                    size="small" 
                    color={config.authType === 'none' ? 'default' : 'secondary'}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {config.baseUrl || 'N/A'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={config.isActive ? 'Active' : 'Inactive'}
                    size="small"
                    color={config.isActive ? 'success' : 'default'}
                  />
                </TableCell>
                <TableCell>
                  {config.updatedAt?.toDate().toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <IconButton size="small" onClick={() => handleEditApiConfig(config)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" onClick={() => handleDeleteApiConfig(config.id)} color="error">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* API Config Dialog */}
      <Dialog open={showApiDialog} onClose={() => { setShowApiDialog(false); resetApiForm(); }} maxWidth="md" fullWidth>
        <DialogTitle>{editingApiId ? 'Edit API Configuration' : 'Add API Configuration'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 2 }}>
              Configure how to connect to external APIs. REST APIs use HTTP methods (GET/POST) and may require authentication via headers, query parameters, or bearer tokens.
            </Alert>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Name"
                  value={currentApiConfig.name}
                  onChange={(e) => setCurrentApiConfig({ ...currentApiConfig, name: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Description"
                  value={currentApiConfig.description}
                  onChange={(e) => setCurrentApiConfig({ ...currentApiConfig, description: e.target.value })}
                  multiline
                  rows={2}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>API Type</InputLabel>
                  <Select
                    value={currentApiConfig.apiType}
                    onChange={(e) => {
                      const type = e.target.value;
                      let updates = { apiType: type };
                      
                      // Set defaults based on API type
                      if (type === 'mfapi') {
                        updates = {
                          ...updates,
                          baseUrl: 'https://api.mfapi.in/mf',
                          navUpdateUrl: 'https://api.mfapi.in/mf',
                          terUpdateUrl: '',
                          httpMethod: 'GET',
                          authType: 'none',
                          apiKey: ''
                        };
                      } else if (type === 'api-ninjas') {
                        updates = {
                          ...updates,
                          baseUrl: 'https://api.api-ninjas.com/v1/mutualfund',
                          httpMethod: 'GET',
                          authType: 'header',
                          authHeaderName: 'X-Api-Key'
                        };
                      } else {
                        // Custom - reset to defaults
                        updates = {
                          ...updates,
                          baseUrl: '',
                          httpMethod: 'GET',
                          authType: 'none'
                        };
                      }
                      
                      setCurrentApiConfig({
                        ...currentApiConfig,
                        ...updates
                      });
                    }}
                    label="API Type"
                  >
                    <MenuItem value="mfapi">MFapi.in (Free - Indian MFs)</MenuItem>
                    <MenuItem value="api-ninjas">API Ninjas (Paid - US MFs)</MenuItem>
                    <MenuItem value="custom">Custom API</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={currentApiConfig.isActive}
                      onChange={(e) => setCurrentApiConfig({ ...currentApiConfig, isActive: e.target.checked })}
                    />
                  }
                  label="Active"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="Base URL"
                  value={currentApiConfig.baseUrl}
                  onChange={(e) => setCurrentApiConfig({ ...currentApiConfig, baseUrl: e.target.value })}
                  helperText="The base URL for the API endpoint (used for full sync)"
                  required
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="NAV Update URL"
                  value={currentApiConfig.navUpdateUrl}
                  onChange={(e) => setCurrentApiConfig({ ...currentApiConfig, navUpdateUrl: e.target.value })}
                  helperText="URL for fetching NAV data only"
                  placeholder="https://api.mfapi.in/mf"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="TER Update URL"
                  value={currentApiConfig.terUpdateUrl}
                  onChange={(e) => setCurrentApiConfig({ ...currentApiConfig, terUpdateUrl: e.target.value })}
                  helperText="URL for fetching TER data (optional)"
                  placeholder="To be configured"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>HTTP Method</InputLabel>
                  <Select
                    value={currentApiConfig.httpMethod}
                    onChange={(e) => setCurrentApiConfig({ ...currentApiConfig, httpMethod: e.target.value })}
                    label="HTTP Method"
                  >
                    <MenuItem value="GET">GET</MenuItem>
                    <MenuItem value="POST">POST</MenuItem>
                    <MenuItem value="PUT">PUT</MenuItem>
                    <MenuItem value="DELETE">DELETE</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth size="small">
                  <InputLabel>Authentication Type</InputLabel>
                  <Select
                    value={currentApiConfig.authType}
                    onChange={(e) => setCurrentApiConfig({ ...currentApiConfig, authType: e.target.value })}
                    label="Authentication Type"
                  >
                    <MenuItem value="none">No Authentication</MenuItem>
                    <MenuItem value="header">API Key in Header</MenuItem>
                    <MenuItem value="query">API Key in Query Param</MenuItem>
                    <MenuItem value="bearer">Bearer Token</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  size="small"
                  label="API Key / Token"
                  value={currentApiConfig.apiKey}
                  onChange={(e) => setCurrentApiConfig({ ...currentApiConfig, apiKey: e.target.value })}
                  type="password"
                  helperText={
                    currentApiConfig.authType === 'none' 
                      ? 'Not required for this authentication type' 
                      : `${currentApiConfig.authType === 'bearer' ? 'Bearer token' : 'API key'} for authentication`
                  }
                  disabled={currentApiConfig.authType === 'none'}
                />
              </Grid>
              
              {currentApiConfig.authType === 'header' && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Header Name"
                    value={currentApiConfig.authHeaderName}
                    onChange={(e) => setCurrentApiConfig({ ...currentApiConfig, authHeaderName: e.target.value })}
                    helperText="Name of the header to send API key (e.g., X-Api-Key, Authorization)"
                    placeholder="X-Api-Key"
                  />
                </Grid>
              )}
              
              {currentApiConfig.authType === 'query' && (
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Query Parameter Name"
                    value={currentApiConfig.authQueryParam}
                    onChange={(e) => setCurrentApiConfig({ ...currentApiConfig, authQueryParam: e.target.value })}
                    helperText="Name of the query parameter to send API key (e.g., api_key, apikey, key)"
                    placeholder="api_key"
                  />
                </Grid>
              )}
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setShowApiDialog(false); resetApiForm(); }}>Cancel</Button>
          <Button onClick={handleSaveApiConfig} variant="contained" disabled={!currentApiConfig.name || !currentApiConfig.baseUrl}>
            {editingApiId ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );

  const renderDataSyncTab = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 3 }}>Data Synchronization</Typography>

      <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 3 }}>
        <Typography variant="body2">
          💡 Sync is allowed once per 24 hours to prevent excessive API usage. 
          Large sync operations (30k+ funds) fetch detailed data including ISIN codes, metadata, current NAV, and 1Y/3Y/5Y returns, which may take 10-15 minutes.
        </Typography>
      </Alert>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Select API Source</InputLabel>
                <Select
                  value={selectedApi}
                  onChange={(e) => setSelectedApi(e.target.value)}
                  label="Select API Source"
                >
                  {apiConfigs.filter(c => c.isActive).map(config => (
                    <MenuItem key={config.id} value={config.id}>
                      {config.name} ({config.apiType})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <Button
                variant="contained"
                startIcon={<SyncIcon />}
                onClick={handleSyncData}
                disabled={syncing || !selectedApi}
                fullWidth
                sx={{ 
                  color: '#fff',
                  '&.Mui-disabled': {
                    color: '#fff'
                  }
                }}
              >
                {syncing ? 'Syncing...' : 'Start Sync'}
              </Button>
            </Grid>
          </Grid>

          {syncing && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {syncStatus}
              </Typography>
              <LinearProgress variant="determinate" value={syncProgress} />
              <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                <Chip label={`Added: ${syncResults.added}`} color="success" size="small" />
                <Chip label={`Updated: ${syncResults.updated}`} color="info" size="small" />
                <Chip label={`Errors: ${syncResults.errors}`} color="error" size="small" />
              </Box>
            </Box>
          )}

          {syncError && (
            <Box sx={{ mt: 3 }}>
              <Alert severity="error" sx={{ mb: 2 }}>
                Sync Failed - See details below
              </Alert>
              <TextField
                fullWidth
                multiline
                rows={8}
                label="Error Details"
                value={syncError}
                size="small"
                InputProps={{
                  readOnly: true,
                  sx: { fontFamily: 'monospace', fontSize: '0.85rem' }
                }}
              />
            </Box>
          )}
        </CardContent>
      </Card>

      <Typography variant="h6" sx={{ mb: 2 }}>Recent Sync Logs</Typography>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Timestamp</TableCell>
              <TableCell>API Source</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Added</TableCell>
              <TableCell>Updated</TableCell>
              <TableCell>Errors</TableCell>
              <TableCell>Error Message</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {syncLogs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>
                  {log.timestamp?.toDate().toLocaleString()}
                </TableCell>
                <TableCell>{log.apiName}</TableCell>
                <TableCell>
                  <Chip
                    label={log.status}
                    size="small"
                    color={log.status === 'completed' ? 'success' : log.status === 'failed' ? 'error' : 'default'}
                  />
                </TableCell>
                <TableCell>{log.results?.added || 0}</TableCell>
                <TableCell>{log.results?.updated || 0}</TableCell>
                <TableCell>{log.results?.errors || 0}</TableCell>
                <TableCell>
                  {log.errorMessage ? (
                    <Tooltip title={log.errorMessage} arrow>
                      <Chip
                        label="View Error"
                        size="small"
                        color="error"
                        variant="outlined"
                        sx={{ cursor: 'pointer' }}
                      />
                    </Tooltip>
                  ) : (
                    '-'
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  const renderSyncJobsTab = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 3 }}>Sync Jobs</Typography>
      
      {/* Job Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={updateNavOnly}
          disabled={activeJob !== null}
          color="primary"
          sx={{
            color: '#fff',
            '&.Mui-disabled': {
              color: 'rgba(255, 255, 255, 0.5)'
            }
          }}
        >
          Update NAV
        </Button>
        <Button
          variant="contained"
          startIcon={<SyncIcon />}
          onClick={updateEverything}
          disabled={activeJob !== null}
          color="secondary"
          sx={{
            color: '#fff',
            '&.Mui-disabled': {
              color: 'rgba(255, 255, 255, 0.5)'
            }
          }}
        >
          Update Everything
        </Button>
        
        {/* Job Control Buttons (shown when job is active) */}
        {activeJob && (
          <>
            <Button
              variant="outlined"
              onClick={jobPaused ? resumeJob : pauseJob}
              color="warning"
              size="small"
            >
              {jobPaused ? 'Resume' : 'Pause'}
            </Button>
            <Button
              variant="outlined"
              onClick={cancelJob}
              color="error"
              size="small"
            >
              Cancel
            </Button>
          </>
        )}
      </Box>

      {/* Active Job Progress */}
      {activeJob && (
        <Card sx={{ mb: 3, bgcolor: jobPaused ? '#fff3e0' : '#f5f5f5' }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Chip 
                  label={activeJob.type === 'nav' ? 'NAV Update' : 'Full Sync'} 
                  color="primary" 
                  size="small"
                />
                {jobPaused && (
                  <Chip 
                    label="PAUSED" 
                    color="warning" 
                    size="small"
                  />
                )}
                <Typography variant="body2" color="text.secondary">
                  Started: {activeJob.startTime.toLocaleTimeString()}
                </Typography>
              </Box>
              <Chip 
                label={formatDuration(jobTimer)} 
                color="info" 
                size="small"
                icon={<InfoIcon />}
              />
            </Box>
            
            <Typography variant="body2" sx={{ mb: 1 }}>
              {jobStatus}
            </Typography>
            
            {activeJob.total > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                {activeJob.processed.toLocaleString()} / {activeJob.total.toLocaleString()} funds
              </Typography>
            )}
            
            <LinearProgress 
              variant="determinate" 
              value={jobProgress} 
              sx={{ 
                height: 8, 
                borderRadius: 1,
                '& .MuiLinearProgress-bar': {
                  backgroundColor: jobPaused ? '#ff9800' : undefined
                }
              }}
            />
            
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block', textAlign: 'right' }}>
              {Math.round(jobProgress)}%
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Job History */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Recent Jobs</Typography>
        
        {jobHistory.length === 0 ? (
          <Alert severity="info">No job history available</Alert>
        ) : (
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Job Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Start Time</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Added</TableCell>
                  <TableCell>Updated</TableCell>
                  <TableCell>Errors</TableCell>
                  <TableCell>Total Processed</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {jobHistory.map((job) => (
                  <TableRow key={job.id} hover>
                    <TableCell>
                      <Chip 
                        label={
                          job.type === 'nav_update' ? 'NAV Update' : 
                          job.type === 'full_sync' ? 'Full Sync' : 
                          job.type
                        } 
                        size="small"
                        color={job.type === 'full_sync' ? 'secondary' : 'primary'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={job.status}
                        size="small"
                        color={
                          job.status === 'completed' ? 'success' : 
                          job.status === 'failed' ? 'error' : 
                          job.status === 'cancelled' ? 'default' :
                          'warning'
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {job.startTime?.toDate ? job.startTime.toDate().toLocaleString() : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {job.duration ? formatDuration(job.duration) : '-'}
                    </TableCell>
                    <TableCell>{job.added || 0}</TableCell>
                    <TableCell>{job.updated || 0}</TableCell>
                    <TableCell>
                      {job.errors > 0 ? (
                        <Chip label={job.errors} size="small" color="error" />
                      ) : (
                        job.errors || 0
                      )}
                    </TableCell>
                    <TableCell>{job.processed || job.totalFunds || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Box>
  );

  const renderDataViewTab = () => {
    const handleSearch = () => {
      loadFundsData(searchTerm);
    };

    const handleKeyPress = (e) => {
      if (e.key === 'Enter') {
        handleSearch();
      }
    };

    return (
      <Box>
        {!dataLoaded && !loadingData ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <StorageIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              Mutual Funds Database
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Total Funds in Database: {totalFunds.toLocaleString()}
            </Typography>
            <Button
              variant="contained"
              startIcon={<RefreshIcon />}
              onClick={() => loadFundsData()}
              sx={{
                background: 'linear-gradient(135deg, #424242 0%, #212121 100%)',
                color: '#fff'
              }}
            >
              Load 10 Random Samples
            </Button>
          </Box>
        ) : (
          <>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6">Mutual Funds Database</Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  size="small"
                  placeholder="Search by name or code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={loadingData}
                  InputProps={{
                    startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                  }}
                />
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleSearch}
                  disabled={loadingData}
                  sx={{
                    background: 'linear-gradient(135deg, #424242 0%, #212121 100%)',
                    color: '#fff',
                    '&.Mui-disabled': {
                      background: 'linear-gradient(135deg, #424242 0%, #212121 100%)',
                      color: 'rgba(255, 255, 255, 0.5)'
                    }
                  }}
                >
                  Search
                </Button>
                <Tooltip title="Refresh data">
                  <IconButton onClick={() => loadFundsData()} disabled={loadingData}>
                    <RefreshIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {loadingData ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <LinearProgress sx={{ mb: 2 }} />
                <Typography variant="body2" color="text.secondary">
                  Loading funds data...
                </Typography>
              </Box>
            ) : (
              <>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Total in Database: {totalFunds.toLocaleString()} | Showing: {fundsData.length} funds
                  {searchTerm && ` (Search results for "${searchTerm}")`}
                </Alert>

        <TableContainer component={Paper} sx={{ maxHeight: 600 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell>Scheme Code</TableCell>
                <TableCell>Scheme Name</TableCell>
                <TableCell>NAV</TableCell>
                <TableCell>NAV As Of</TableCell>
                <TableCell>Returns 1Y</TableCell>
                <TableCell>Returns 3Y</TableCell>
                <TableCell>Returns 5Y</TableCell>
                <TableCell>TER</TableCell>
                <TableCell>TER As Of</TableCell>
                <TableCell>ISIN Growth</TableCell>
                <TableCell>ISIN Div</TableCell>
                <TableCell>Fund House</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Sub Category</TableCell>
                <TableCell>Scheme Type</TableCell>
                <TableCell>Min SIP</TableCell>
                <TableCell>Expense Ratio</TableCell>
                <TableCell>Fund Size (Cr)</TableCell>
                <TableCell>Rating</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Last Updated</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {fundsData.map((fund) => (
                <TableRow key={fund.id} hover>
                  <TableCell>{fund.schemeCode}</TableCell>
                  <TableCell sx={{ minWidth: 250 }}>
                    <Typography variant="body2">{fund.schemeName}</Typography>
                  </TableCell>
                  <TableCell>
                    {fund.nav ? `₹${fund.nav}` : '-'}
                  </TableCell>
                  <TableCell sx={{ minWidth: 100 }}>
                    {fund.navAsOf || '-'}
                  </TableCell>
                  <TableCell>
                    {fund.returns1yr ? `${fund.returns1yr}%` : '-'}
                  </TableCell>
                  <TableCell>
                    {fund.returns3yr ? `${fund.returns3yr}%` : '-'}
                  </TableCell>
                  <TableCell>
                    {fund.returns5yr ? `${fund.returns5yr}%` : '-'}
                  </TableCell>
                  <TableCell>
                    {fund.ter ? `${fund.ter}%` : '-'}
                  </TableCell>
                  <TableCell sx={{ minWidth: 100 }}>
                    {fund.terAsOf || '-'}
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                      {fund.isinGrowth || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                      {fund.isinDivReinvestment || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ minWidth: 180 }}>
                    <Typography variant="caption">
                      {fund.fundHouse || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ minWidth: 120 }}>
                    <Typography variant="caption">
                      {fund.category || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ minWidth: 150 }}>
                    <Typography variant="caption">
                      {fund.subCategory || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ minWidth: 120 }}>
                    <Typography variant="caption">
                      {fund.schemeType || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {fund.minSip ? `₹${fund.minSip}` : '-'}
                  </TableCell>
                  <TableCell>
                    {fund.expenseRatio ? `${fund.expenseRatio}%` : '-'}
                  </TableCell>
                  <TableCell>
                    {fund.fundSizeCr ? `₹${fund.fundSizeCr}` : '-'}
                  </TableCell>
                  <TableCell>
                    {fund.rating ? (
                      <Chip label={fund.rating} size="small" color="primary" variant="outlined" />
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <Chip label={fund.source || 'Unknown'} size="small" />
                  </TableCell>
                  <TableCell sx={{ minWidth: 100 }}>
                    {fund.lastUpdated?.toDate().toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={fund.isActive ? 'Active' : 'Inactive'}
                      size="small"
                      color={fund.isActive ? 'success' : 'default'}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        
        {!searchTerm && fundsData.length === 10 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Showing 10 random samples. Use search to find specific funds.
          </Alert>
        )}
        
        {searchTerm && fundsData.length >= 500 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Showing maximum 500 search results. Refine your search for more specific results.
          </Alert>
        )}
              </>
            )}
          </>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <StorageIcon sx={{ fontSize: 24, color: '#42a5f5' }} />
        <Typography variant="h6" fontWeight="700" sx={{ fontSize: '1.1rem' }}>
          Mutual Fund Data Manager
        </Typography>
      </Box>

      {message.text && (
        <Alert severity={message.type} onClose={() => setMessage({ type: '', text: '' })} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      )}

      <Card>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
          <Tab label="API Conf." />
          <Tab label="Data Sync" />
          <Tab label="Sync Jobs" />
          <Tab label="DB View" />
        </Tabs>

        <CardContent sx={{ minHeight: 400 }}>
          {tabValue === 0 && renderApiConfigTab()}
          {tabValue === 1 && renderDataSyncTab()}
          {tabValue === 2 && renderSyncJobsTab()}
          {tabValue === 3 && renderDataViewTab()}
        </CardContent>
      </Card>
    </Box>
  );
};

export default MutualFundDataManager;
