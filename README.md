SMART Sweeper
=============

Description
---------------
Sweeper application for SMART cryptocurrency (http://smartcash.cc) to allow easy retrieval of gift funds. Runs on Windows, Linux, and Mac.

Releases
---------------
Releases are forthcoming. SMART Sweeper is still in the development stage.

Requirements
---------------
* [Node.js](http://nodejs.org) - 8.9.0+
* [npm](http://npmjs.com) - 5.6.0+

Run node -v and npm -v from a command prompt to make sure they're in your PATH.

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

User files
---------------
The database (smart-sweeper.json) and the log files are saved in the following folders:

* **Windows**: %APPDATA%/smart-sweeper
* **Linux**: $XDG_CONFIG_HOME/smart-sweeper or ~/.config/smart-sweeper
* **Mac**: ~/Library/Application Support/smart-sweeper

Other software used
-------------------
Software | License
-------- | --------
[devtron](https://github.com/electron/devtron) | MIT
[electron](https://github.com/electron/electron) | MIT
[electron-store](https://github.com/sindresorhus/electron-store) | MIT
[electron-util](https://github.com/sindresorhus/electron-util) | MIT
[electron-debug](https://github.com/sindresorhus/electron-debug) | MIT
[electron-is-dev](https://github.com/sindresorhus/electron-is-dev) | MIT
[elemon](https://github.com/manidlou/elemon) | MIT
[smartcashjs-lib](https://github.com/SmartCash/SmartCashjs-lib) | MIT
[winston](https://github.com/winstonjs/winston) | MIT

[The SmartExplorer API](http://explorer3.smartcash.cc) is used to check wallet balances and transactions.