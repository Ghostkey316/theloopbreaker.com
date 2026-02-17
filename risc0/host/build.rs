// Build script for the Vaultfire host program.
//
// This script uses risc0-build to compile the guest program and generate
// the ELF binary and image ID constants.
//
// If the guest is not available (e.g., in CI without the RISC Zero toolchain),
// the build will still succeed — the host will use the placeholder ELF path.

fn main() {
    // Attempt to build the guest program using risc0-build.
    // If the RISC Zero toolchain is not installed, this is a no-op.
    //
    // In a monorepo setup, uncomment the following:
    // risc0_build::embed_methods();
    //
    // For standalone builds, the guest ELF is loaded at runtime from a file path.
    println!("cargo:rerun-if-changed=../guest/src/main.rs");
    println!("cargo:rerun-if-changed=../guest/Cargo.toml");
}
