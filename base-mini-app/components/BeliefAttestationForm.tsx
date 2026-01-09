'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Check, Loader2, AlertCircle, Github, Database, Wallet } from 'lucide-react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { keccak256, toBytes, encodeAbiParameters, bytesToHex } from 'viem';
import { DILITHIUM_ATTESTOR_ADDRESS, DILITHIUM_ATTESTOR_ABI, MODULE_IDS, getModuleName, getModuleColor } from '@/lib/contracts';

type Step = 'compose' | 'select-module' | 'sign' | 'submit' | 'success';

export function BeliefAttestationForm() {
  const { address } = useAccount();
  const [step, setStep] = useState<Step>('compose');
  const [belief, setBelief] = useState('');
  const [moduleId, setModuleId] = useState<number>(MODULE_IDS.GITHUB);
  const [loyaltyProof, setLoyaltyProof] = useState('');
  const [loyaltyScore] = useState(9500); // Default high score for demo

  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step !== 'submit') return;

    try {
      // Create belief hash
      const beliefHash = keccak256(toBytes(belief));

      // Create mock signature (in production, this would be a real signature)
      const mockSignature = new Uint8Array(65);
      for (let i = 0; i < 65; i++) {
        mockSignature[i] = Math.floor(Math.random() * 256);
      }

      // Create mock STARK proof (in production, this would come from RISC Zero prover)
      const mockProof = new Uint8Array(128);
      for (let i = 0; i < 128; i++) {
        mockProof[i] = Math.floor(Math.random() * 256);
      }

      // Encode zkProofBundle: (bytes proofBytes, bytes signature)
      const zkProofBundle = encodeAbiParameters(
        [{ type: 'bytes' }, { type: 'bytes' }],
        [bytesToHex(mockProof), bytesToHex(mockSignature)]
      );

      // Submit to contract
      writeContract({
        address: DILITHIUM_ATTESTOR_ADDRESS,
        abi: DILITHIUM_ATTESTOR_ABI,
        functionName: 'attestBelief',
        args: [beliefHash, zkProofBundle],
      });
    } catch (err) {
      console.error('Error submitting belief:', err);
    }
  };

  const nextStep = () => {
    if (step === 'compose' && belief.length > 0) {
      setStep('select-module');
    } else if (step === 'select-module' && loyaltyProof.length > 0) {
      setStep('sign');
    } else if (step === 'sign') {
      setStep('submit');
    }
  };

  const prevStep = () => {
    if (step === 'select-module') setStep('compose');
    else if (step === 'sign') setStep('select-module');
    else if (step === 'submit') setStep('sign');
  };

  // Handle success
  if (isSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card text-center max-w-2xl mx-auto"
      >
        <div className="w-16 h-16 rounded-full bg-vaultfire-green/20 flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-vaultfire-green" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Belief Attested Successfully! 🎉</h2>
        <p className="text-base-gray-400 mb-6">
          Your belief has been recorded on Base blockchain with zero-knowledge proof.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => {
              setBelief('');
              setLoyaltyProof('');
              setStep('compose');
            }}
            className="btn-secondary"
          >
            Attest Another Belief
          </button>
          {hash && (
            <a
              href={`https://basescan.org/tx/${hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
            >
              View on Basescan
            </a>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card"
      >
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-2">Create Belief Attestation</h2>
          <p className="text-base-gray-400">
            {step === 'compose' && 'Compose your belief statement'}
            {step === 'select-module' && 'Link your belief to activity proof'}
            {step === 'sign' && 'Review and sign your attestation'}
            {step === 'submit' && 'Submit to Base blockchain'}
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center gap-2 mb-8">
          {['compose', 'select-module', 'sign', 'submit'].map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div
                className={`h-2 rounded-full flex-1 transition-all ${
                  step === s
                    ? 'bg-base-blue'
                    : ['compose', 'select-module', 'sign', 'submit'].indexOf(step) > i
                    ? 'bg-vaultfire-green'
                    : 'bg-white/10'
                }`}
              />
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <AnimatePresence mode="wait">
            {/* Step 1: Compose Belief */}
            {step === 'compose' && (
              <motion.div
                key="compose"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium mb-2">Your Belief</label>
                  <textarea
                    value={belief}
                    onChange={(e) => setBelief(e.target.value)}
                    placeholder="e.g., AI must serve human flourishing and dignity"
                    className="input min-h-[120px] resize-none"
                    required
                  />
                  <p className="text-xs text-base-gray-500 mt-2">
                    This will be hashed and never revealed publicly. Only you know the actual text.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={nextStep}
                  disabled={belief.length === 0}
                  className="btn-primary w-full"
                >
                  Continue
                </button>
              </motion.div>
            )}

            {/* Step 2: Select Module & Proof */}
            {step === 'select-module' && (
              <motion.div
                key="select-module"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium mb-3">Link to Activity</label>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { id: MODULE_IDS.GITHUB, icon: Github, name: 'GitHub', color: 'bg-gray-900' },
                      { id: MODULE_IDS.NS3, icon: Database, name: 'NS3', color: 'bg-vaultfire-purple' },
                      { id: MODULE_IDS.BASE, icon: Wallet, name: 'Base', color: 'bg-base-blue' },
                    ].map(({ id, icon: Icon, name, color }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setModuleId(id)}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          moduleId === id
                            ? `${color} border-white/50`
                            : 'glass border-white/10 hover:border-white/30'
                        }`}
                      >
                        <Icon className="w-6 h-6 mx-auto mb-2" />
                        <span className="text-sm font-medium">{name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Activity Proof</label>
                  <input
                    type="text"
                    value={loyaltyProof}
                    onChange={(e) => setLoyaltyProof(e.target.value)}
                    placeholder={
                      moduleId === MODULE_IDS.GITHUB
                        ? 'github:commit_sha'
                        : moduleId === MODULE_IDS.NS3
                        ? 'ns3:session_id'
                        : 'base:tx_hash'
                    }
                    className="input"
                    required
                  />
                  <p className="text-xs text-base-gray-500 mt-2">
                    Format: {getModuleName(moduleId).toLowerCase()}:identifier
                  </p>
                </div>

                <div className="flex gap-3">
                  <button type="button" onClick={prevStep} className="btn-secondary flex-1">
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={nextStep}
                    disabled={loyaltyProof.length === 0}
                    className="btn-primary flex-1"
                  >
                    Continue
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Review & Sign */}
            {step === 'sign' && (
              <motion.div
                key="sign"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="glass rounded-xl p-4 space-y-3">
                  <div>
                    <p className="text-xs text-base-gray-500 mb-1">Belief Hash</p>
                    <p className="font-mono text-sm break-all">
                      {keccak256(toBytes(belief))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-base-gray-500 mb-1">Module</p>
                    <span className={`badge ${getModuleColor(moduleId)}`}>
                      {getModuleName(moduleId)}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-base-gray-500 mb-1">Activity Proof</p>
                    <p className="font-mono text-sm">{loyaltyProof}</p>
                  </div>
                  <div>
                    <p className="text-xs text-base-gray-500 mb-1">Loyalty Score</p>
                    <p className="text-sm">{loyaltyScore / 100}% (Hidden in ZK proof)</p>
                  </div>
                </div>

                <div className="flex items-start gap-2 p-3 rounded-xl bg-base-blue/10 border border-base-blue/20">
                  <AlertCircle className="w-5 h-5 text-base-blue shrink-0 mt-0.5" />
                  <p className="text-sm text-base-gray-300">
                    Your belief text is never revealed. Only the hash and proof are submitted on-chain.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button type="button" onClick={prevStep} className="btn-secondary flex-1">
                    Back
                  </button>
                  <button type="button" onClick={nextStep} className="btn-primary flex-1">
                    Sign & Continue
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 4: Submit */}
            {step === 'submit' && (
              <motion.div
                key="submit"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="text-center py-6">
                  <div className="w-16 h-16 rounded-full bg-vaultfire-purple/20 flex items-center justify-center mx-auto mb-4">
                    <Send className="w-8 h-8 text-vaultfire-purple" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Ready to Submit</h3>
                  <p className="text-base-gray-400">
                    Your belief attestation will be recorded on Base blockchain
                  </p>
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-vaultfire-red/10 border border-vaultfire-red/20">
                    <AlertCircle className="w-5 h-5 text-vaultfire-red shrink-0 mt-0.5" />
                    <p className="text-sm text-vaultfire-red">
                      {error.message}
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={prevStep}
                    disabled={isPending || isConfirming}
                    className="btn-secondary flex-1"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isPending || isConfirming}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    {(isPending || isConfirming) && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isPending
                      ? 'Confirm in Wallet...'
                      : isConfirming
                      ? 'Submitting...'
                      : 'Submit to Base'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </motion.div>

      {/* Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-6 glass rounded-xl p-4"
      >
        <p className="text-sm text-base-gray-400">
          <span className="font-semibold text-white">Privacy Note:</span> Your belief text
          is never stored or transmitted. Only a cryptographic hash is submitted on-chain
          with a zero-knowledge proof that verifies your loyalty score without revealing it.
        </p>
      </motion.div>
    </div>
  );
}
