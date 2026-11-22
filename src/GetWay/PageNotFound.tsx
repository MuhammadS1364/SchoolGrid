import type { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export interface NotFoundPageProps {
  homeHref?: string;
  loginHref?: string;
}

export const NotFoundPage: FC<NotFoundPageProps> = ({
  homeHref = '/dashboard',
  loginHref = '/',
}) => {
  const navigate = useNavigate();

  const handleGoBack = (): void => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(homeHref, { replace: true });
    }
  };

  const go = (to: string) => (e: { preventDefault: () => void }): void => {
    e.preventDefault();
    navigate(to);
  };

  return (
    <div className="min-h-dvh bg-slate-50 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-6 sm:p-8 text-center"
      >
        {/* Status Badge & 404 Display */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-semibold uppercase tracking-wider mb-4"
        >
          <span>Error 404</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, duration: 0.35 }}
          className="text-6xl font-extrabold text-slate-900 tracking-tight"
        >
          404
        </motion.h1>

        <motion.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="text-xl font-bold text-slate-800 mt-3"
        >
          Page Not Found
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.3 }}
          className="text-sm text-slate-500 mt-2 leading-relaxed"
        >
          The page you are looking for in the{' '}
          <span className="font-medium text-slate-700">
            Multi-School Management System
          </span>{' '}
          doesn&apos;t exist, was moved, or you may not have access to this route.
        </motion.p>

        {/* Actions */}
        <div className="mt-8 space-y-3">
          <motion.a
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            href={homeHref}
            onClick={go(homeHref)}
            className="w-full h-11 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg shadow-sm hover:shadow transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Go to Dashboard
          </motion.a>

          <div className="grid grid-cols-2 gap-3">
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="button"
              onClick={handleGoBack}
              className="h-10 flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-sm rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 cursor-pointer"
            >
              Go Back
            </motion.button>

            <motion.a
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              href={loginHref}
              onClick={go(loginHref)}
              className="h-10 flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-sm rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Login Gateway
            </motion.a>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default NotFoundPage;