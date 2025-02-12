import { ImageSourcePropType } from 'react-native'; // ^0.71.0

// Define the images object with all application image assets
export const images: Record<string, ImageSourcePropType> = {
  // Main branding assets
  appLogo: require('./branding/app-logo.png'),
  authBackground: require('./backgrounds/auth-background.png'),
  dashboardHeader: require('./backgrounds/dashboard-header.png'),

  // Default placeholders
  accountPlaceholder: require('./placeholders/account-placeholder.png'),
  budgetPlaceholder: require('./placeholders/budget-placeholder.png'),
  investmentPlaceholder: require('./placeholders/investment-placeholder.png'),
  transactionPlaceholder: require('./placeholders/transaction-placeholder.png'),

  // State illustrations
  emptyState: require('./illustrations/empty-state.png'),
  errorState: require('./illustrations/error-state.png'),

  // Bank institution icons
  bankIcons: {
    chase: require('./banks/chase.png'),
    bankOfAmerica: require('./banks/bank-of-america.png'),
    wellsFargo: require('./banks/wells-fargo.png'),
    citibank: require('./banks/citibank.png'),
    usBank: require('./banks/us-bank.png'),
    capitalOne: require('./banks/capital-one.png'),
    tdBank: require('./banks/td-bank.png'),
    pnc: require('./banks/pnc.png'),
  },

  // Transaction category icons
  categoryIcons: {
    housing: require('./categories/housing.png'),
    transportation: require('./categories/transportation.png'),
    foodAndDining: require('./categories/food-dining.png'),
    shopping: require('./categories/shopping.png'),
    utilities: require('./categories/utilities.png'),
    healthcare: require('./categories/healthcare.png'),
    entertainment: require('./categories/entertainment.png'),
    travel: require('./categories/travel.png'),
    education: require('./categories/education.png'),
    income: require('./categories/income.png'),
    transfer: require('./categories/transfer.png'),
    other: require('./categories/other.png'),
  },

  // Navigation and tab bar icons
  navigationIcons: {
    home: require('./navigation/home.png'),
    accounts: require('./navigation/accounts.png'),
    budgets: require('./navigation/budgets.png'),
    investments: require('./navigation/investments.png'),
    profile: require('./navigation/profile.png'),
    settings: require('./navigation/settings.png'),
    help: require('./navigation/help.png'),
    notifications: require('./navigation/notifications.png'),
    search: require('./navigation/search.png'),
    add: require('./navigation/add.png'),
    back: require('./navigation/back.png'),
    close: require('./navigation/close.png'),
    menu: require('./navigation/menu.png'),
  },
};

// Named exports for specific image categories
export const {
  appLogo,
  authBackground,
  dashboardHeader,
  accountPlaceholder,
  budgetPlaceholder,
  investmentPlaceholder,
  transactionPlaceholder,
  emptyState,
  errorState,
  bankIcons,
  categoryIcons,
  navigationIcons,
} = images;