'use client';

import { motion } from 'framer-motion';
import { Activity, TrendingUp, Flame, Users } from 'lucide-react';
import { useState, useEffect } from 'react';

// Mock live activity data (in production, fetch from contract events)
const mockActivities = [
  { id: 1, module: 'GitHub', score: 9800, time: '2 min ago', country: 'US' },
  { id: 2, module: 'Base', score: 9500, time: '5 min ago', country: 'UK' },
  { id: 3, module: 'NS3', score: 9700, time: '8 min ago', country: 'CA' },
  { id: 4, module: 'GitHub', score: 9600, time: '12 min ago', country: 'DE' },
  { id: 5, module: 'Base', score: 9900, time: '15 min ago', country: 'JP' },
];

export function LiveActivityFeed() {
  const [activities, setActivities] = useState(mockActivities);
  const [totalAttestations, setTotalAttestations] = useState(1247);
  const [activeNow, setActiveNow] = useState(23);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      const newActivity = {
        id: Date.now(),
        module: ['GitHub', 'Base', 'NS3'][Math.floor(Math.random() * 3)],
        score: 9000 + Math.floor(Math.random() * 1000),
        time: 'Just now',
        country: ['US', 'UK', 'CA', 'DE', 'JP', 'FR', 'AU'][Math.floor(Math.random() * 7)],
      };

      setActivities(prev => [newActivity, ...prev.slice(0, 4)]);
      setTotalAttestations(prev => prev + 1);
      setActiveNow(prev => Math.max(15, prev + (Math.random() > 0.5 ? 1 : -1)));
    }, 8000); // New attestation every 8 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-12 px-4 border-t border-white/10 bg-gradient-to-b from-transparent to-vaultfire-purple/5">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-vaultfire-green/10 border border-vaultfire-green/20 mb-4">
            <Flame className="w-4 h-4 text-vaultfire-green animate-pulse" />
            <span className="text-sm font-medium text-vaultfire-green">
              Live Activity • {activeNow} active now
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold mb-2">
            Real People, Real Beliefs
          </h2>
          <p className="text-base-gray-400 max-w-2xl mx-auto">
            Join thousands proving their beliefs on Base. All identities protected by zero-knowledge.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="card text-center"
          >
            <Activity className="w-8 h-8 text-base-blue mx-auto mb-2" />
            <div className="text-3xl font-bold mb-1">{totalAttestations.toLocaleString()}</div>
            <div className="text-sm text-base-gray-400">Total Attestations</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="card text-center"
          >
            <Users className="w-8 h-8 text-vaultfire-purple mx-auto mb-2" />
            <div className="text-3xl font-bold mb-1">{activeNow}</div>
            <div className="text-sm text-base-gray-400">Active Right Now</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="card text-center"
          >
            <TrendingUp className="w-8 h-8 text-vaultfire-green mx-auto mb-2" />
            <div className="text-3xl font-bold mb-1">95%</div>
            <div className="text-sm text-base-gray-400">Avg Loyalty Score</div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="glass rounded-2xl p-6"
        >
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-base-blue" />
            Recent Attestations
          </h3>

          <div className="space-y-3">
            {activities.map((activity, index) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-base-blue to-vaultfire-purple flex items-center justify-center text-xs font-mono">
                    {activity.country}
                  </div>
                  <div>
                    <div className="font-medium">Anonymous Believer</div>
                    <div className="text-xs text-base-gray-400">
                      via {activity.module} • {activity.time}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-vaultfire-green">
                    {(activity.score / 100).toFixed(0)}% Score
                  </div>
                  <div className="text-xs text-base-gray-500">Verified ✓</div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
