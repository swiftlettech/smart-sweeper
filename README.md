SMART Sweeper
=============

Description
---------------
Sweeper application for SmartCash cryptocurrency (http://smartcash.cc) to allow easy retrieval of gift funds. Runs on Windows, Linux, and Mac OS.

Releases
---------------
Releases are forthcoming. SMART Sweeper is still in the development stage.

Requirements
---------------
* [Node.js](http://nodejs.org) - 8.9.0+
* [npm](http://npmjs.com) - 5.6.0+
* [SmartCash wallet](https://smartcash.cc/wallets/) for Windows, Linux, or Mac OS - 1.1.1+ ([there is a bootstrap file to shorten sync time](https://smartcash.freshdesk.com/support/solutions/articles/35000027174-using-the-bootstrap-to-speedup-sync-process))

Run node -v and npm -v from a command prompt to make sure they're in your PATH. Open your wallet to make sure that it is up to date before launching SMART Sweeper.

Installation
---------------
``` bash
npm install
```

To run
---------------
``` bash
npm start
```

Configuration
---------------
Your SmartCash wallet must be started with the following arguments:
```
-txindex=1
-server
-rpcbind=127.0.0.1
-rpcport=9678
-rpcuser=rpcusername
-rpcpassword=rpcpassword
```

If it isn't running, SMART Sweeper will start it for you with the above arguments. You can also [edit your wallet's smartcash.conf file](https://smartcash.freshdesk.com/support/solutions/articles/35000038702-smartcash-conf-configuration-file). Please don't do this with your wallet running.

```
txindex=1
server=1
rpcbind=127.0.0.1
rpcport=9678
rpcuser=rpcusername
rpcpassword=rpcpassword
```

User files
---------------
The database (smart-sweeper.json) and the log files are saved in the following folders:

* **Windows**: %APPDATA%/SMART Sweeper
* **Linux**: $XDG_CONFIG_HOME/smart-sweeper or ~/.config/SMART Sweeper
* **Mac**: ~/Library/Application Support/SMART Sweeper

The log files are also in JSON format and can be read with a general log viewer such as [glogg](https://github.com/nickbnf/glogg).


Other software used
-------------------
Software | License
-------- | --------
[devtron](https://github.com/electron/devtron) | MIT
[electron](https://github.com/electron/electron) | MIT
[electron-debug](https://github.com/sindresorhus/electron-debug) | MIT
[electron-is-dev](https://github.com/sindresorhus/electron-is-dev) | MIT
[electron-store](https://github.com/sindresorhus/electron-store) | MIT
[electron-util](https://github.com/sindresorhus/electron-util) | MIT
[elemon](https://github.com/manidlou/elemon) | MIT
[melanke-watchjs](https://github.com/melanke/Watch.JS) | MIT
[node-bitcoin](https://github.com/freewil/node-bitcoin) | Unlicense
[ps-node](https://github.com/neekey/ps) | MIT
[smartcashjs-lib](https://github.com/SmartCash/SmartCashjs-lib) | MIT
[SmartCash Paper Wallet Generator](https://github.com/SmartCash/PaperWalletGenerator) | ?
[winston](https://github.com/winstonjs/winston) | MIT

[The SmartExplorer API](http://explorer3.smartcash.cc) is used to check the current block count and get info about the project addresses.