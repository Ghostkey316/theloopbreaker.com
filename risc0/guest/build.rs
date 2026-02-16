// Build script for the Vaultfire belief attestation guest program.
//
// This script is invoked by `cargo build` and uses the risc0-build crate to
// compile the guest program for the RISC Zero zkVM target.  The resulting ELF
// binary and its image ID are made available to the host crate via the
// `guest_util` module.

fn main() {
    // The risc0-build crate handles cross-compilation to the riscv32im target
    // and generates the ELF binary + image ID constants.
    risc0_build::embed_methods();
}
