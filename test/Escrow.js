const { expect } = require("chai");
const { ethers } = require("hardhat");

const tokens = (n) => {
  return ethers.utils.parseUnits(n.toString(), "ether");
};

describe("Escrow", () => {
  let realEstate, escrow;
  let buyer, seller, lender, inspector;

  beforeEach(async () => {
    //setup accounts
    [buyer, seller, inspector, lender] = await ethers.getSigners();

    //Deploy Real Estate Contract
    const RealEstate = await ethers.getContractFactory("RealEstate");
    realEstate = await RealEstate.deploy();

    //Mint
    let transaction = await realEstate
      .connect(seller)
      .mint(
        "https://ipfs.io/ipfs/QmQUozrHLAusXDxrvsESJ3PYB3rUeUuBAvVWw6nop2uu7c/1.png"
      );
    await transaction.wait();

    //Deploy Real Estate Contract
    const Escrow = await ethers.getContractFactory("Escrow");
    escrow = await Escrow.deploy(
      realEstate.address,
      lender.address,
      inspector.address,
      seller.address
    );

    //approving tranfer of nft from seller tor escrow
    transaction = await realEstate.connect(seller).approve(escrow.address, 1);
    await transaction.wait();

    // listing the property
    transaction = await escrow
      .connect(seller)
      .list(1, buyer.address, tokens(20), tokens(10));
    await transaction.wait();
  });

  describe("Deployment", () => {
    it("Return NFT address", async () => {
      let result = await escrow.nftAddress();
      expect(result).to.be.equal(realEstate.address);
    });

    it("Return inspector address", async () => {
      let result = await escrow.inspector();
      expect(result).to.be.equal(inspector.address);
    });

    it("Return seller address", async () => {
      let result = await escrow.seller();
      expect(result).to.be.equal(seller.address);
    });

    it("Return lender address", async () => {
      let result = await escrow.lender();
      expect(result).to.be.equal(lender.address);
    });
  });

  describe("Listing", () => {
    it("Update transfer To Escrow", async () => {
      let res = await realEstate.ownerOf(1);
      expect(res).to.be.equal(escrow.address);
    });

    it("MApping of 1", async () => {
      let res = await escrow.isListed(1);
      expect(res).to.be.equal(true);
    });
    it("Returns buyer", async () => {
      const res = await escrow.buyer(1);
      expect(res).to.be.equal(buyer.address);
    });
    it("Returns Purchase Price", async () => {
      let res = await escrow.purchasePrice(1);
      expect(res).to.be.equal(tokens(20));
    });
    it("Returns Escrow Amount", async () => {
      let res = await escrow.escrowAmount(1);
      expect(res).to.be.equal(tokens(10));
    });
  });

  describe("Deposits", () => {
    it("Updates Contract Balance", async () => {
      const transaction = await escrow
        .connect(buyer)
        .depositEarnest(1, { value: tokens(11) });
      await transaction.wait();
      const bal = await escrow.getBalance();
      expect(bal).to.be.equal(tokens(11));
    });
    it("Contract Balance", async () => {
      const bal = await escrow.getBalance();
      expect(bal).to.be.equal(tokens(0));
    });
  });
  describe("Inspection", () => {
    it("Updates Inspection Status", async () => {
      const transaction = await escrow
        .connect(inspector)
        .updateInspectionStatus(true, 1);
      await transaction.wait();
      const bal = await escrow.inspection(1);
      expect(bal).to.be.equal(true);
    });
  });
  describe("Approval", () => {
    it("Updates Approval status", async () => {
      let transaction = await escrow.approveSale(false, 1);
      await transaction.wait();
      let bal = await escrow.connect(seller).approval(1, seller.address);
      expect(bal).to.be.equal(false);

      transaction = await escrow.approveSale(true, 1);
      await transaction.wait();
      bal = await escrow.connect(buyer).approval(1, buyer.address);
      expect(bal).to.be.equal(true);

      transaction = await escrow.approveSale(false, 1);
      await transaction.wait();
      bal = await escrow.connect(lender).approval(1, lender.address);
      expect(bal).to.be.equal(false);
    });
  });
  describe("Sale", () => {
    beforeEach(async () => {
      let transaction = await escrow.connect(buyer).depositEarnest(1, { value: tokens(10) });
      await transaction.wait();

      transaction = await escrow.connect(inspector).updateInspectionStatus(true, 1);
      await transaction.wait();

      transaction = await escrow.connect(buyer).approveSale(true, 1);
      await transaction.wait();

      transaction = await escrow.connect(seller).approveSale(true, 1);
      await transaction.wait();

      transaction = await escrow.connect(lender).approveSale(true, 1);
      await transaction.wait();

      await lender.sendTransaction({ to: escrow.address, value: tokens(10) });

      transaction = await escrow.connect(seller).finalizeSale(1);
      await transaction.wait();
      
    });
    it("Updates owner", async () => {
        expect(await realEstate.ownerOf(1)).to.be.equal(buyer.address);
      });

    it("Updates balance", async () => {
      expect(await escrow.getBalance()).to.be.equal(0);
    });
  });
});
