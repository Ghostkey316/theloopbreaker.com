const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time, loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("PurchasingPowerBonds", function () {
  async function deployFixture() {
    const [owner, company, worker1, worker2, verifier1, verifier2] = await ethers.getSigners();

    const PurchasingPowerBonds = await ethers.getContractFactory("PurchasingPowerBonds");
    const contract = await PurchasingPowerBonds.deploy();

    return { contract, owner, company, worker1, worker2, verifier1, verifier2 };
  }

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      const { contract } = await loadFixture(deployFixture);
      expect(await contract.nextBondId()).to.equal(1);
    });
  });

  describe("Bond Creation", function () {
    it("Should create a bond with valid parameters", async function () {
      const { contract, company } = await loadFixture(deployFixture);

      const stakeAmount = ethers.parseEther("1.0");
      const tx = await contract.connect(company).createBond(
        100, // workerCount
        { value: stakeAmount }
      );

      await expect(tx).to.emit(contract, "BondCreated");

      const bond = await contract.getBond(1);
      expect(bond.company).to.equal(company.address);
      expect(bond.workerCount).to.equal(100);
      expect(bond.stakeAmount).to.equal(stakeAmount);
      expect(bond.active).to.be.true;
    });

    it("Should fail to create bond without stake", async function () {
      const { contract, company } = await loadFixture(deployFixture);

      await expect(
        contract.connect(company).createBond(100, { value: 0 })
      ).to.be.revertedWith("Must stake funds");
    });

    it("Should fail to create bond without workers", async function () {
      const { contract, company } = await loadFixture(deployFixture);

      await expect(
        contract.connect(company).createBond(0, { value: ethers.parseEther("1.0") })
      ).to.be.revertedWith("Must have workers");
    });

    it("Should increment bond IDs correctly", async function () {
      const { contract, company } = await loadFixture(deployFixture);

      await contract.connect(company).createBond(100, { value: ethers.parseEther("1.0") });
      await contract.connect(company).createBond(50, { value: ethers.parseEther("0.5") });

      expect(await contract.nextBondId()).to.equal(3);
    });
  });

  describe("Security & Edge Cases", function () {
    it("Should handle large worker counts", async function () {
      const { contract, company } = await loadFixture(deployFixture);

      const tx = await contract.connect(company).createBond(10000, { value: ethers.parseEther("10.0") });
      await expect(tx).to.emit(contract, "BondCreated");

      const bond = await contract.getBond(1);
      expect(bond.workerCount).to.equal(10000);
    });

    it("Should allow multiple bonds from same company", async function () {
      const { contract, company } = await loadFixture(deployFixture);

      await contract.connect(company).createBond(100, { value: ethers.parseEther("1.0") });
      await contract.connect(company).createBond(200, { value: ethers.parseEther("2.0") });

      expect(await contract.nextBondId()).to.equal(3);
    });
  });
});
