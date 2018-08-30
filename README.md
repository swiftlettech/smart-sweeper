SmartSweeper
=============

NOTE
---------------
SmartSweeper is still in the development stage so it is unstable and missing functionality. DO NOT attempt to create transactions with this app.


Description
---------------
Sweeper application for [SmartCash cryptocurrency](http://smartcash.cc) to allow easy retrieval of gift funds. Runs only on Windows at the moment. It isn't necessary to input your wallet passphrase to use SmartSweeper.


Features
---------------
* Create projects to organize promotions
* Send funds to multiple promotional wallets
* Retrieve promotional funds from wallets that were not redeemed
* Print paper wallets
* Access logs


Releases
---------------
Releases are forthcoming.


Requirements
---------------
* [Node.js](http://nodejs.org) - 8.9.0+
* [npm](http://npmjs.com) - 5.6.0+
* [SmartCash Node Client](https://smartcash.cc/wallets/) for Windows - 1.2.3+ (excluding 1.2.4) ([there is a bootstrap file to shorten sync time](https://smartcash.freshdesk.com/support/solutions/articles/35000027174-using-the-bootstrap-to-speedup-sync-process))

Run node -v and npm -v from a command prompt to make sure they're in your PATH. Open your SmartCash desktop wallet application to make sure it is up to date before launching SmartSweeper.


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
SmartSweeper can be configured by modifying .env in the root directory. The app will create it for you the first time you load it, but you can create the file yourself prior to that, which will help if you didn't use the default SmartCash installation path. The default values for Windows are shown below.
```
rpc.host=127.0.0.1
rpc.port=9678
rpc.username=rpcusername
rpc.password=rpcpassword
smartcashPath=C:\Program Files\SmartCash\
```

* rpc.host is the IP address that the SmartCash Node Client RPC server is bound to.
* rpc.port is the port that the SmartCash node client RPC server is listening on.
* rpc.username is the SmartCash Node Client RPC server username.
* rpc.password is the SmartCash Node Client RPC server password.
* smartcashPath is the full path to your SmartCash Node Client installation. You must include a trailing slash.


Your SmartCash wallet must be started with the following arguments:
```
-txindex=1 (if SmartCash Node Client is < v1.2.3)
-server
-rpcbind=127.0.0.1
-rpcport=9678
-rpcuser=rpcusername
-rpcpassword=rpcpassword
```

If it isn't running, SmartSweeper will start it for you with the above arguments. You can also [edit your wallet's smartcash.conf file](https://smartcash.freshdesk.com/support/solutions/articles/35000038702-smartcash-conf-configuration-file). Please don't do this with your wallet running.

```
txindex=1 (if SmartCash Node Client is < v1.2.3)
server=1
rpcbind=127.0.0.1
rpcport=9678
rpcuser=rpcusername
rpcpassword=rpcpassword
```

The values of rpc.host, rpc.port, rpc.username, and rpc.password in .env must match those in the program arguments or the smartcash.conf file.


User files
---------------
The database (smart-sweeper.json), the app config file (smart-sweeper-config.json) and the log files are saved in the following folders:

* **Windows**: %APPDATA%/SmartSweeper

**It is recommended that you back up smart-sweeper.json to a safe place.**

The log files are also in JSON format and can be viewed with a general log viewer such as [glogg](https://github.com/nickbnf/glogg). The user logs record user actions while the system logs record errors (and may include transaction ids and public keys).


KNOWN ISSUES
---------------
* electron-store error: "EPERM operation not permitted" sometimes occurs on Windows when reading a config file. SmartSweeper will exit when it does.


Other software used
-------------------
Software | License
-------- | --------
[AngularJS](http://angularjs.org) | MIT
[AngularUI Bootstrap](https://github.com/angular-ui/bootstrap) | MIT
[Bootstrap](https://getbootstrap.com/docs/3.3/) | MIT
[clipboard.js](https://clipboardjs.com) | MIT
[devtron](https://github.com/electron/devtron) | MIT
[electron](https://github.com/electron/electron) | MIT
[electron-debug](https://github.com/sindresorhus/electron-debug) | MIT
[electron-is-dev](https://github.com/sindresorhus/electron-is-dev) | MIT
[electron-store](https://github.com/sindresorhus/electron-store) | MIT
[electron-util](https://github.com/sindresorhus/electron-util) | MIT
[elemon](https://github.com/manidlou/elemon) | MIT
[exp-config](https://github.com/ExpressenAB/exp-config) | MIT
[melanke-watchjs](https://github.com/melanke/Watch.JS) | MIT
[Moment.js](https://github.com/moment/moment) | MIT
[node-smartcash](https://github.com/miyakoj/node-smartcash) | MIT
[ps-node](https://github.com/neekey/ps) | MIT
[request](https://github.com/request/request) | Apache-2.0
[smartcashjs-lib](https://github.com/SmartCash/SmartCashjs-lib) | MIT
[SmartCash Paper Wallet Generator](https://github.com/SmartCash/PaperWalletGenerator) | ?
[winston](https://github.com/winstonjs/winston) | MIT


[The SmartCash Insight Explorer API](https://insight.smartcash.cc) is used to check the current block count and to get information about project addresses.