import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  FormLabel,
  LinearProgress,
  Card,
  CardContent,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Chip,
  CircularProgress
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { useAuth } from '../Auth/AuthContext';
import { useNavigate } from 'react-router-dom';
import Footer from '../Common/Footer';

const riskQuestions = [
  {
    id: 1,
    category: 'Investment Horizon',
    question: 'What is your investment time horizon?',
    options: [
      { text: 'Less than 3 years', score: 1 },
      { text: '3-5 years', score: 2 },
      { text: '5-10 years', score: 3 },
      { text: 'More than 10 years', score: 4 }
    ]
  },
  {
    id: 2,
    category: 'Risk Tolerance',
    question: 'If your investment portfolio dropped by 20% in a month, what would you do?',
    options: [
      { text: 'Sell all investments immediately', score: 1 },
      { text: 'Sell some investments to reduce risk', score: 2 },
      { text: 'Hold and wait for recovery', score: 3 },
      { text: 'Buy more investments at lower prices', score: 4 }
    ]
  },
  {
    id: 3,
    category: 'Financial Goals',
    question: 'What is your primary investment goal?',
    options: [
      { text: 'Preserve capital with minimal risk', score: 1 },
      { text: 'Generate regular income', score: 2 },
      { text: 'Moderate growth with some income', score: 3 },
      { text: 'Maximum long-term growth', score: 4 }
    ]
  },
  {
    id: 4,
    category: 'Experience',
    question: 'How would you describe your investment experience?',
    options: [
      { text: 'No experience or just starting', score: 1 },
      { text: 'Some experience with basic investments', score: 2 },
      { text: 'Moderate experience with various products', score: 3 },
      { text: 'Extensive experience with complex products', score: 4 }
    ]
  },
  {
    id: 5,
    category: 'Income Stability',
    question: 'How stable is your current income?',
    options: [
      { text: 'Unstable or irregular income', score: 1 },
      { text: 'Somewhat stable with occasional fluctuations', score: 2 },
      { text: 'Stable with predictable income', score: 3 },
      { text: 'Very stable with multiple income sources', score: 4 }
    ]
  },
  {
    id: 6,
    category: 'Emergency Fund',
    question: 'Do you have an emergency fund covering at least 6 months of expenses?',
    options: [
      { text: 'No emergency fund', score: 1 },
      { text: 'Less than 3 months covered', score: 2 },
      { text: '3-6 months covered', score: 3 },
      { text: 'More than 6 months covered', score: 4 }
    ]
  },
  {
    id: 7,
    category: 'Age Factor',
    question: 'What is your age group?',
    options: [
      { text: 'Above 60 years', score: 1 },
      { text: '45-60 years', score: 2 },
      { text: '30-45 years', score: 3 },
      { text: 'Below 30 years', score: 4 }
    ]
  },
  {
    id: 8,
    category: 'Financial Obligations',
    question: 'What percentage of your income goes toward debt payments or fixed obligations?',
    options: [
      { text: 'More than 50%', score: 1 },
      { text: '30-50%', score: 2 },
      { text: '10-30%', score: 3 },
      { text: 'Less than 10%', score: 4 }
    ]
  },
  {
    id: 9,
    category: 'Market Knowledge',
    question: 'How comfortable are you with understanding market fluctuations?',
    options: [
      { text: 'Not comfortable at all', score: 1 },
      { text: 'Somewhat uncomfortable', score: 2 },
      { text: 'Fairly comfortable', score: 3 },
      { text: 'Very comfortable', score: 4 }
    ]
  },
  {
    id: 10,
    category: 'Return Expectations',
    question: 'What annual return would you be satisfied with?',
    options: [
      { text: '3-5% (Bank FD level)', score: 1 },
      { text: '6-8% (Conservative growth)', score: 2 },
      { text: '9-12% (Moderate growth)', score: 3 },
      { text: '13%+ (Aggressive growth)', score: 4 }
    ]
  }
];

function RiskProfile() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResult, setShowResult] = useState(false);
  const [riskProfile, setRiskProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const handleAnswer = (questionId, score) => {
    setAnswers({ ...answers, [questionId]: score });
  };

  const handleNext = () => {
    if (currentQuestion < riskQuestions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const calculateRiskProfile = () => {
    const totalScore = Object.values(answers).reduce((sum, score) => sum + score, 0);
    const maxScore = riskQuestions.length * 4;
    const percentage = (totalScore / maxScore) * 100;

    let profile = {};
    if (percentage <= 25) {
      profile = {
        type: 'Conservative',
        description: 'You prefer capital preservation and minimal risk. Suitable investments include fixed deposits, bonds, and conservative mutual funds.',
        color: '#4caf50',
        score: totalScore,
        maxScore: maxScore,
        percentage: percentage.toFixed(1),
        recommendations: [
          'Fixed Deposits and Savings Accounts',
          'Government Bonds and Treasury Securities',
          'Debt Mutual Funds',
          'Conservative Hybrid Funds (max 20% equity)'
        ]
      };
    } else if (percentage <= 50) {
      profile = {
        type: 'Moderately Conservative',
        description: 'You prefer stability with some growth potential. A balanced mix of debt and equity suits you.',
        color: '#2196f3',
        score: totalScore,
        maxScore: maxScore,
        percentage: percentage.toFixed(1),
        recommendations: [
          'Balanced Hybrid Funds (30-40% equity)',
          'Corporate Bonds and Debentures',
          'Large Cap Equity Funds (limited exposure)',
          'Monthly Income Plans'
        ]
      };
    } else if (percentage <= 75) {
      profile = {
        type: 'Moderate',
        description: 'You are comfortable with moderate risk for potentially higher returns. A diversified portfolio with equity exposure is suitable.',
        color: '#ff9800',
        score: totalScore,
        maxScore: maxScore,
        percentage: percentage.toFixed(1),
        recommendations: [
          'Diversified Equity Funds',
          'Balanced Advantage Funds',
          'Mix of Large Cap and Mid Cap Funds',
          'Index Funds and ETFs'
        ]
      };
    } else {
      profile = {
        type: 'Aggressive',
        description: 'You are willing to take significant risks for maximum growth potential. High equity exposure and growth stocks suit you.',
        color: '#f44336',
        score: totalScore,
        maxScore: maxScore,
        percentage: percentage.toFixed(1),
        recommendations: [
          'Mid Cap and Small Cap Funds',
          'Sectoral/Thematic Funds',
          'Growth-oriented Equity Funds',
          'Direct Equity Investments',
          'International Equity Funds'
        ]
      };
    }

    setRiskProfile(profile);
    setShowResult(true);
  };

  const handleSubmit = async () => {
    // Check if all questions are answered
    if (Object.keys(answers).length < riskQuestions.length) {
      setError('Please answer all questions before submitting.');
      return;
    }

    calculateRiskProfile();
  };

  const saveRiskProfile = async () => {
    if (!currentUser || !riskProfile) return;

    setSaving(true);
    setError('');

    try {
      console.log('Saving risk profile for user:', currentUser.uid);
      const docRef = await addDoc(collection(db, 'risk_profiles'), {
        userId: currentUser.uid,
        type: riskProfile.type,
        score: riskProfile.score,
        maxScore: riskProfile.maxScore,
        percentage: parseFloat(riskProfile.percentage),
        answers: answers,
        createdAt: serverTimestamp(),
        timestamp: new Date().toISOString()
      });
      
      console.log('Risk profile saved successfully with ID:', docRef.id);
      setSaved(true);
      setTimeout(() => {
        navigate('/my-profile');
      }, 1500);
    } catch (err) {
      console.error('Error saving risk profile:', err);
      console.error('Error details:', err.message, err.code);
      setError('Failed to save risk profile. Please try again. Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const restartAssessment = () => {
    setCurrentQuestion(0);
    setAnswers({});
    setShowResult(false);
    setRiskProfile(null);
    setSaved(false);
    setError('');
  };

  const progress = ((currentQuestion + 1) / riskQuestions.length) * 100;
  const currentQ = riskQuestions[currentQuestion];
  const isAnswered = answers[currentQ.id] !== undefined;
  const allAnswered = Object.keys(answers).length === riskQuestions.length;

  return (
    <Box sx={{ pb: 10, bgcolor: '#f5f7fa', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3, px: 2, pt: 2 }}>
        <AssessmentIcon sx={{ fontSize: 28, color: '#1976d2' }} />
        <Typography variant="h5" fontWeight="700">
          Build Your Risk Profile
        </Typography>
      </Box>

      {!showResult ? (
        <Box sx={{ px: 2 }}>
          {/* Progress */}
          <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="body2" color="text.secondary" fontWeight={600}>
                Question {currentQuestion + 1} of {riskQuestions.length}
              </Typography>
              <Chip
                label={`${allAnswered ? 'Complete' : `${Object.keys(answers).length}/${riskQuestions.length} Answered`}`}
                size="small"
                color={allAnswered ? 'primary' : 'default'}
                icon={allAnswered ? <CheckCircleIcon /> : null}
              />
            </Box>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: '#e0e0e0',
                '& .MuiLinearProgress-bar': {
                  bgcolor: '#1976d2'
                }
              }}
            />
          </Paper>

          {/* Question Card */}
          <Card elevation={3} sx={{ mb: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Chip
                label={currentQ.category}
                size="small"
                sx={{ mb: 2, bgcolor: '#e3f2fd', color: '#1976d2', fontWeight: 600 }}
              />
              <FormControl component="fieldset" fullWidth>
                <FormLabel sx={{ mb: 3, fontSize: '1.1rem', fontWeight: 600, color: '#212121' }}>
                  {currentQ.question}
                </FormLabel>
                <RadioGroup
                  value={answers[currentQ.id] || ''}
                  onChange={(e) => handleAnswer(currentQ.id, parseInt(e.target.value))}
                >
                  {currentQ.options.map((option, index) => (
                    <FormControlLabel
                      key={index}
                      value={option.score}
                      control={<Radio />}
                      label={option.text}
                      sx={{
                        mb: 1.5,
                        p: 2,
                        borderRadius: 2,
                        border: '1px solid #e0e0e0',
                        '&:hover': {
                          bgcolor: '#f5f5f5'
                        },
                        ...(answers[currentQ.id] === option.score && {
                          bgcolor: '#e3f2fd',
                          borderColor: '#1976d2'
                        })
                      }}
                    />
                  ))}
                </RadioGroup>
              </FormControl>
            </CardContent>
          </Card>

          {/* Navigation Buttons */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <Button
              variant="outlined"
              onClick={handlePrevious}
              disabled={currentQuestion === 0}
              sx={{ flex: 1 }}
            >
              Previous
            </Button>
            {currentQuestion < riskQuestions.length - 1 ? (
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={!isAnswered}
                sx={{ 
                  flex: 2, 
                  color: '#ffffff',
                  '&.Mui-disabled': {
                    color: '#ffffff'
                  }
                }}
              >
                Next Question
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={!allAnswered}
                sx={{
                  flex: 2,
                  background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)'
                  }
                }}
              >
                Calculate Risk Profile
              </Button>
            )}
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {/* Stepper for small screens */}
          <Paper elevation={1} sx={{ p: 2, display: { xs: 'none', sm: 'block' } }}>
            <Stepper activeStep={currentQuestion} alternativeLabel>
              {riskQuestions.map((q, index) => (
                <Step key={q.id} completed={answers[q.id] !== undefined}>
                  <StepLabel>{q.id}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </Paper>
        </Box>
      ) : (
        <Box sx={{ px: 2 }}>
          {/* Result Card */}
          <Card elevation={3} sx={{ mb: 3, borderTop: `4px solid ${riskProfile.color}` }}>
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ textAlign: 'center', mb: 3 }}>
                <CheckCircleIcon sx={{ fontSize: 80, color: riskProfile.color, mb: 2 }} />
                <Typography variant="h4" fontWeight="700" gutterBottom>
                  {riskProfile.type}
                </Typography>
                <Chip
                  label={`Score: ${riskProfile.score}/${riskProfile.maxScore} (${riskProfile.percentage}%)`}
                  sx={{ bgcolor: riskProfile.color, color: '#fff', fontWeight: 600 }}
                />
              </Box>

              <Typography variant="body1" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
                {riskProfile.description}
              </Typography>

              <Box sx={{ bgcolor: '#e3f2fd', p: 3, borderRadius: 2, mb: 3 }}>
                <Typography variant="h6" fontWeight="600" gutterBottom>
                  Recommended Investment Types:
                </Typography>
                <Box component="ul" sx={{ pl: 2 }}>
                  {riskProfile.recommendations.map((rec, index) => (
                    <Typography component="li" key={index} variant="body2" sx={{ mb: 1 }}>
                      {rec}
                    </Typography>
                  ))}
                </Box>
              </Box>

              {saved ? (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Risk profile saved successfully! Redirecting to your profile...
                </Alert>
              ) : (
                <>
                  {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Button
                      variant="outlined"
                      onClick={restartAssessment}
                      fullWidth
                      disabled={saving}
                    >
                      Retake Assessment
                    </Button>
                    <Button
                      variant="contained"
                      onClick={saveRiskProfile}
                      fullWidth
                      disabled={saving || saved}
                      sx={{
                        background: 'linear-gradient(135deg, #424242 0%, #212121 100%)',
                        color: '#ffffff',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #616161 0%, #424242 100%)'
                        }
                      }}
                    >
                      {saving ? <CircularProgress size={24} color="inherit" /> : 'Save to Profile'}
                    </Button>
                  </Box>
                </>
              )}
            </CardContent>
          </Card>

          {/* Information Box */}
          <Alert severity="info">
            <Typography variant="body2" fontWeight={600} gutterBottom>
              Important Note:
            </Typography>
            <Typography variant="body2">
              This risk profile assessment is for educational purposes only. It should not be considered as financial advice. 
              Please consult with a certified financial advisor before making any investment decisions.
            </Typography>
          </Alert>
        </Box>
      )}

      <Footer />
    </Box>
  );
}

export default RiskProfile;
