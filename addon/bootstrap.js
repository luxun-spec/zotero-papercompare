var PaperCompareScope;
var PaperCompareStopped=false;
function startup({id,version,rootURI}) {
 PaperCompareStopped=false;
 Zotero.debug('PaperCompare '+version+' starting');
 // Defer window-dependent work until the UI is ready without blocking startup.
 Promise.resolve(Zotero.uiReadyPromise).then(async()=>{
 try {
 if(PaperCompareStopped)return;
 const main=Zotero.getMainWindow();
 PaperCompareScope={Zotero,Services,ChromeUtils,IOUtils,PathUtils,Components,console:main.console,crypto:main.crypto,structuredClone:main.structuredClone.bind(main)};
 Services.scriptloader.loadSubScript(rootURI+'content/plugin.js',PaperCompareScope);
 await PaperCompareScope.PaperCompare.start(rootURI);
 } catch(error) {
 Zotero.logError(error);
 await IOUtils.writeUTF8(PathUtils.join(Zotero.Profile.dir,'papercompare-startup-error.log'),String(error)+'\n'+error.stack);
 }
 });
}
async function shutdown() {
 PaperCompareStopped=true;
 if(PaperCompareScope){await PaperCompareScope.PaperCompare.stop();PaperCompareScope=null;}
}
function install(){}
function uninstall(){}
function onMainWindowLoad({window}){PaperCompareScope?.PaperCompare.attach(window)}
function onMainWindowUnload({window}){PaperCompareScope?.PaperCompare.detach(window)}
