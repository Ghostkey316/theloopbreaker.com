// Learn more: https://github.com/testing-library/jest-dom
require('@testing-library/jest-dom');

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      pathname: '/',
      query: {},
      asPath: '/',
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return '/';
  },
}));

// Mock wagmi hooks
jest.mock('wagmi', () => ({
  useAccount: () => ({
    address: '0x1234567890123456789012345678901234567890',
    isConnected: false,
    isConnecting: false,
    isDisconnected: true,
  }),
  useWriteContract: () => ({
    writeContract: jest.fn(),
    data: undefined,
    error: null,
    isPending: false,
  }),
  useWaitForTransactionReceipt: () => ({
    isLoading: false,
    isSuccess: false,
  }),
}));

// Mock RainbowKit
jest.mock('@rainbow-me/rainbowkit', () => {
  const React = require('react');
  return {
    ConnectButton: function ConnectButton(props) {
      return React.createElement('div', { 'data-testid': 'connect-button' }, props.children);
    },
    RainbowKitProvider: function RainbowKitProvider(props) {
      return React.createElement('div', null, props.children);
    },
    darkTheme: jest.fn(),
  };
});

// Mock framer-motion
jest.mock('framer-motion', () => {
  const React = require('react');
  return {
    motion: {
      div: function MotionDiv(props) {
        return React.createElement('div', props, props.children);
      },
      button: function MotionButton(props) {
        return React.createElement('button', props, props.children);
      },
      a: function MotionA(props) {
        return React.createElement('a', props, props.children);
      },
      span: function MotionSpan(props) {
        return React.createElement('span', props, props.children);
      },
    },
    AnimatePresence: function AnimatePresence(props) {
      return React.createElement(React.Fragment, null, props.children);
    },
  };
});

// Suppress console errors in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};
