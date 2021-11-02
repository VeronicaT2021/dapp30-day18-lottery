const { expectRevert, time } = require('@openzeppelin/test-helpers');
const { assertion } = require('@openzeppelin/test-helpers/src/expectRevert');
const { web3 } = require('@openzeppelin/test-helpers/src/setup');
const Lottery = artifacts.require('Lottery.sol');

const balances = async addresses => {
  const balanceResults = await Promise.all(addresses.map(address =>
    web3.eth.getBalance(address)
  ));
  return balanceResults.map(balance => web3.utils.toBN(balance));
};

contract('Lottery', (accounts) => {
  let lottery;
  beforeEach(async () => {
    lottery = await Lottery.new(2);
  });

  it('Should NOT create bet if not admin', async () => {
    await expectRevert(
      lottery.createBet(2, 100, { from: accounts[3] }),
      'only admin'
    )
  });

  it('Should NOT create bet if state not idle', async () => {
    await lottery.createBet(2, 100);
    await expectRevert(
      lottery.createBet(2, 100),
      'current state does not allow this'
    )
  });

  it('Should create a bet', async () => {
    await lottery.createBet(2, 100);
    assert((await lottery.currentState()).toNumber() == 1)
    assert((await lottery.betCount()).toNumber() == 2)
    assert((await lottery.betSize()).toNumber() == 100)
  });

  it('Should NOT bet if not in state BETTING', async () => {
    await expectRevert(
      lottery.bet(),
      'current state does not allow this'
    )
  });

  it('Should NOT bet if not sending exact bet amount', async () => {
    await lottery.createBet(2, 100);
    await expectRevert(
      lottery.bet({ value: 50 }),
      'can only bet exactly the bet size'
    )
  });

  it('Should bet', async () => {
    const players = [accounts[1], accounts[2]]
    await lottery.createBet(2, web3.utils.toWei('1', 'ether'));
    const balanceBefore = await balances(players)
    const txs = await Promise.all(players.map(player => lottery.bet({
      from: player,
      value: web3.utils.toWei('1', 'ether'),
      gasPrice: 1
    })))
    const balanceAfter = await balances(players)
    const result = players.some((player, i) => {
      const gasUsed = web3.utils.toBN(txs[i].receipt.gasUsed)
      // 2 * 98 / 100 = 1.96, minus 1 for the initial cost for joining the bet
      const expected = web3.utils.toBN(web3.utils.toWei('0.96', 'ether'))
      return balanceAfter[i].sub(balanceBefore[i]).add(gasUsed).eq(expected);
    })

    assert(result)
  });

  it('Should NOT cancel if not betting', async () => {
    await expectRevert(
      lottery.cancel({ from: accounts[0] }),
      'current state does not allow this'
    )
  });

  it('Should NOT cancel if not admin', async () => {
    await lottery.createBet(2, 100);
    await expectRevert(
      lottery.cancel({ from: accounts[3] }),
      'only admin'
    )
  });

  it('Should cancel', async () => {
    await lottery.createBet(2, 100);
    await lottery.bet({ from: accounts[1], value: 100 })
    const balanceBefore = web3.utils.toBN(await web3.eth.getBalance(accounts[1]));
    await lottery.cancel({ from: accounts[0] });
    const balanceAfter = web3.utils.toBN(await web3.eth.getBalance(accounts[1]));
    assert((await lottery.currentState()).toNumber() == 0)
    assert(balanceAfter.sub(balanceBefore).toNumber() == 100)
  });
});
