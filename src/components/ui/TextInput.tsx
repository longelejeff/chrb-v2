import { forwardRef } from 'react';

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ hasError, className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        {...props}
        className={`w-full px-3 sm:px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base transition-colors ${
          hasError ? 'border-red-500 bg-red-50' : 'border-slate-300'
        } ${className}`}
      />
    );
  }
);

TextInput.displayName = 'TextInput';
