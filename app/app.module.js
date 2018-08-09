(function() {
    'use strict';

    angular.module('SmartSweeper', [
        'SmartSweeper.dashboard',
        'SmartSweeper.create',
        'SmartSweeper.fund',
        'SmartSweeper.sweep',
        'SmartSweeper.log',
        'SmartSweeper.help',
        'SmartSweeperUtils',
        'ui.bootstrap',
        'ngAnimate',
        'router',
        'ngTouch'
    ])
    .controller('SmartController', function($scope, $document, $filter, $uibModal) {
        const electron = window.nodeRequire('electron');
        const {ipcRenderer} = electron;
        const isOnline = window.nodeRequire('is-online');

        var ctrl = this;

        $scope.init = function() {
            //$document.find('#appAlert, .formAlert').addClass('hide');

            $(window).on("resize", function(event) {
                ctrl.setPageHeight();
            });
            
            isOnline().then(online => {
                ctrl.isOnline = online;
                electron.remote.getGlobal('sharedObject').isOnline = online;
                $scope.$broadcast('onlineCheck', {isOnline: ctrl.isOnline});
                    
                if (ctrl.isOnline) {
                    $scope.hasBeenOnline = true;
                    ctrl.setPageHeight();
                }
            })

            ctrl.coreRunning = false;
            ctrl.rpcConnected = false;
            
            ctrl.setActivePage('dashboard');
            ctrl.sortOptions = {property: 'name', reverse: false};
            
            //ctrl.setModalMsg('data', 'test');
        };
        
        ipcRenderer.on('onlineCheckAPP', (event, args) => {
            $scope.$apply(function() {
                if (ctrl.isOnline !== undefined)
                    ctrl.isOnline = args.isOnline;

                if (ctrl.isOnline)
                    ctrl.setPageHeight();
            });
        });

        ipcRenderer.on('coreCheckAPP', (event, args) => {
            $scope.$apply(function() {
                if (args.coreRunning !== undefined) {
                    ctrl.coreRunning = args.coreRunning;
                    ctrl.setPageHeight();
                }
                else if (args.coreError !== undefined) {
                    ctrl.coreError = args.coreError;
                }
            });
        });

        ipcRenderer.on('rpcCheckAPP', (event, args) => {
            $scope.$apply(function() {
                if (args.rpcConnected !== undefined) {
                    ctrl.rpcConnected = args.rpcConnected;
                    ctrl.setPageHeight();
                }
                else if (args.rpcError !== undefined) {
                    ctrl.rpcError = args.rpcError;
                }
            });
        });

        ipcRenderer.on('coreSyncCheckAPP', (event, args) => {
            $scope.$apply(function() {
                if (args.coreSynced !== undefined) {
                    ctrl.coreSynced = args.coreSynced;
                    ctrl.setPageHeight();
                }
                else if (args.coreSyncError !== undefined) {
                    ctrl.coreSyncError = args.coreSyncError;
                }
            });
        });
        
        ipcRenderer.on('blockExplorerErrorAPP', (event, args) => {
            $scope.$apply(function() {
                if (args.blockExplorerError !== undefined) {
                    ctrl.blockExplorerError = args.blockExplorerError;
                    ctrl.setPageHeight();
                }
            });
        });

        ctrl.setActivePage = function(page) {
            ctrl.activePage = page;
            console.log('active page: ' + ctrl.activePage);
            ctrl.eventCleanup();

            if (ctrl.activePage !== 'dashboard')
                $document.find('#page-wrapper').css('background-image', 'none');
            else
                $document.find('#page-wrapper').css('background-image', 'url("images/SmartSweeper-logo.png")');
        };

        ctrl.setPageHeight = function() {
            var projectInfoHeight = 96; // pixels per project info area
            var projectSpaceRatio = (projectInfoHeight * electron.remote.getGlobal('availableProjects').list.length) / screen.height;
            var spaceRatioMax = electron.remote.getGlobal('availableProjects').list.length * 0.1;
            console.log('projectSpaceRatio: ', projectSpaceRatio);
            
            var statusMsgs = 0;
            
            if (!ctrl.isOnline)
                statusMsgs++;
            if (!ctrl.coreRunning)
                statusMsgs++;
            if (!ctrl.rpcConnected)
                statusMsgs++;
            if (!ctrl.coreSynced)
                statusMsgs++;
            if (ctrl.blockExplorerError)
                statusMsgs++;
            
            //console.log(ctrl.activePage)
            
            if ((ctrl.activePage === "dashboard" && statusMsgs > 2) ||
                ((ctrl.activePage === "create" || ctrl.activePage === "fund" || ctrl.activePage === "sweep") && (electron.remote.getGlobal('availableProjects').list.length > 4)))
            {
                //projectSpaceRatio <= spaceRatioMax
                //electron.remote.getGlobal('availableProjects').list.length > 4
                // the page should scroll
                //console.log('this page should scroll');
                $document.find('#page-wrapper').css('height', '');
            }
            else {
                // the page shouldn't scroll
                //console.log('test')

                if (window.innerWidth >= 700 && window.innerHeight >= 600) {
                    //console.log('this page should not scroll');
                    $document.find('#page-wrapper').css({
                        height: function() {
                            return window.innerHeight - (parseInt($document.find('body').css('margin-top'))*2);
                        }
                    });
                }
                
                if (ctrl.activePage === "logs") {
                    var buttonHeight = 22 + parseInt($document.find('#log button').css('margin-bottom'));                    
                    var logboxHeight = $document.find('#page-wrapper').height() - $document.find('#statusMsgs').height() - buttonHeight - $document.find('#log h5').outerHeight(true) - 30;
                    $document.find('#log textarea').css('height', logboxHeight + 'px');
                }
            }
        };
        
        /* Return the index of a project in the database. */
        ctrl.getDbIndex = function(projectID) {
            var arrayIndex;

            electron.remote.getGlobal('availableProjects').list.forEach(function(project, index) {
                if (project.id == projectID)
                    arrayIndex = index;
            });

            return arrayIndex;
        }

        /* Clean up all page-related ipcRenderer events if they're not system events or global app events. */
        ctrl.eventCleanup = function() {
            var events = ipcRenderer._events;

            angular.forEach(events, function(event, key) {
                //console.log(event)
                //console.log(key)
                
                if (key.indexOf('CHROME_') == -1 && key.indexOf('ELECTRON_') == -1 && key.indexOf('APP') == -1)
                    ipcRenderer.removeAllListeners(key);
            });
        }
        
        ctrl.setModalMsg = function(type, msg) {
            var alertSuccess;
            
            if (type === "data")
                alertSuccess = true;
            else
                alertSuccess = false;
            
            ctrl.alertModal = $uibModal.open({
                ariaDescribedBy: 'modal-body',
                templateUrl: 'app/utils/alertModal.html',
                controller: function($uibModalInstance, alertSuccess, modalMsg) {
                    var ctrl = this;
                    
                    ctrl.alertSuccess = alertSuccess;
                    ctrl.modalMsg = modalMsg;
                    
                    ctrl.close = function() {
                        console.log('click');
                        $uibModalInstance.dismiss('close');
                    };
                    
                    // fix unhandled modal promise error when ignoring the result
                    // from: https://github.com/angular-ui/bootstrap/issues/6501#issuecomment-292255152
                    $uibModalInstance.result.catch(function () { $uibModalInstance.close(); })
                    
                },
                controllerAs: '$modalCtrl',
                backdrop: true,
                backdropClass: 'alertModalBg',
                resolve: {
                    alertSuccess: function() {
                        return alertSuccess;
                    },
                    modalMsg: function() {
                        return msg;
                    }
                }
            });
        };
        
        /* Show/hide a project's private key. */
        ctrl.showPK = function(projectID) {
            var index = ctrl.getDbIndex(projectID);
            electron.remote.getGlobal('availableProjects').list[index].showPrivateKey = !electron.remote.getGlobal('availableProjects').list[index].showPrivateKey;
            ctrl.availableProjects = electron.remote.getGlobal('availableProjects').list;
        };

        /*
         * Natural Sort Angular sort comparator - Version 0.8.1 - Released under MIT license
         * Original Author: Jim Palmer (based on chunking idea from Dave Koelle)
         * Slightly modified (to sort objects) by Miyako Jones
         */
        ctrl.naturalSort = function(a, b) {        
            a = a.value;
            b = b.value;

            var re = /(^([+\-]?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?(?=\D|\s|$))|^0x[\da-fA-F]+$|\d+)/g,
                sre = /^\s+|\s+$/g,   // trim pre-post whitespace
                snre = /\s+/g,        // normalize all whitespace to single ' ' character
                dre = /(^([\w ]+,?[\w ]+)?[\w ]+,?[\w ]+\d+:\d+(:\d+)?[\w ]?|^\d{1,4}[\/\-]\d{1,4}[\/\-]\d{1,4}|^\w+, \w+ \d+, \d{4})/,
                hre = /^0x[0-9a-f]+$/i,
                ore = /^0/,
                i = function(s) {
                    return (('' + s).toLowerCase() || '' + s).replace(sre, '');
                },
                // convert all to strings strip whitespace
                x = i(a),
                y = i(b),
                // chunk/tokenize
                xN = x.replace(re, '\0$1\0').replace(/\0$/,'').replace(/^\0/,'').split('\0'),
                yN = y.replace(re, '\0$1\0').replace(/\0$/,'').replace(/^\0/,'').split('\0'),
                // numeric, hex or date detection
                xD = parseInt(x.match(hre), 16) || (xN.length !== 1 && Date.parse(x)),
                yD = parseInt(y.match(hre), 16) || xD && y.match(dre) && Date.parse(y) || null,
                normChunk = function(s, l) {
                    // normalize spaces; find floats not starting with '0', string or 0 if not defined (Clint Priest)
                    return (!s.match(ore) || l == 1) && parseFloat(s) || s.replace(snre, ' ').replace(sre, '') || 0;
                },
                oFxNcL, oFyNcL;
            // first try and sort Hex codes or Dates
            if (yD) {
                if (xD < yD) { return -1; }
                else if (xD > yD) { return 1; }
            }
            // natural sorting through split numeric strings and default strings
            for(var cLoc = 0, xNl = xN.length, yNl = yN.length, numS = Math.max(xNl, yNl); cLoc < numS; cLoc++) {
                oFxNcL = normChunk(xN[cLoc] || '', xNl);
                oFyNcL = normChunk(yN[cLoc] || '', yNl);
                // handle numeric vs string comparison - number < string - (Kyle Adams)
                if (isNaN(oFxNcL) !== isNaN(oFyNcL)) {
                    return isNaN(oFxNcL) ? 1 : -1;
                }
                // if unicode use locale comparison
                if (/[^\x00-\x80]/.test(oFxNcL + oFyNcL) && oFxNcL.localeCompare) {
                    var comp = oFxNcL.localeCompare(oFyNcL);
                    return comp / Math.abs(comp);
                }
                if (oFxNcL < oFyNcL) { return -1; }
                else if (oFxNcL > oFyNcL) { return 1; }
            }
        };

        function resetSortFlags() {
            ctrl.nameSortFlag = -1;
            ctrl.totalFundsSortFlag = -1;
            ctrl.addrAmtSortFlag = -1;
            ctrl.percentClaimedSortFlag = -1;
            ctrl.expDateSortFlag = -1;
            ctrl.sweepDateSortFlag = -1;
        }

        ctrl.updateSortOptions = function(property, reverse) {
            ctrl.sortOptions = {property: property, reverse: reverse};

            var reverseFlag;

            if (reverse)
                reverseFlag = -1;
            else
                reverseFlag = 1; 

            resetSortFlags();

            if (property === "name")
                ctrl.nameSortFlag = reverseFlag;
            else if (property === "totalFunds")
                ctrl.totalFundsSortFlag = reverseFlag;
            else if (property === "addrAmt")
                ctrl.addrAmtSortFlag = reverseFlag;
            else if (property === "percentClaimed")
                ctrl.percentClaimedSortFlag = reverseFlag;
            else if (property === "expDate")
                ctrl.expDateSortFlag = reverseFlag;
            else if (property === "sweepDate")
                ctrl.sweepDateSortFlag = reverseFlag;
        };
    });
})();