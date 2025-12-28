import React from 'react';
import { Box } from '@mui/material';
import LedgerManagement from '../Admin/LedgerManagement';
import Footer from '../Common/Footer';

function LedgerPage() {
  return (
    <Box sx={{ pb: 10 }}>
      {/* Ledger Management Component with header */}
      <LedgerManagement showHeader={true} />

      <Footer />
    </Box>
  );
}

export default LedgerPage;
