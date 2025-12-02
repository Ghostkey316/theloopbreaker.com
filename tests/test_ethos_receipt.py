import json
from pathlib import Path

from vaultfire.quantum.sovereign_layer import EthosReceiptGenerator


def test_ethos_receipt_generator_links_to_genesis(tmp_path):
    output_path = tmp_path / "ethos_receipt.vfr"
    generator = EthosReceiptGenerator(output_path)

    receipt = generator.generate_receipt(
        identity="Ghostkey-316",
        wallet="bpow20.cb.id",
        dna_signature="dna-sig-123",
        genesis_signature="genesis-hash-xyz",
    )

    assert receipt["proof"].startswith("ethos-")
    assert receipt["chain_hash"].startswith("chain-")
    assert Path(output_path).exists()

    on_disk = json.loads(output_path.read_text())
    assert on_disk["identity"] == "Ghostkey-316"
    assert on_disk["genesis_signature"] == "genesis-hash-xyz"
