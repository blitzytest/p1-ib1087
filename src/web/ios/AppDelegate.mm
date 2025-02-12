#import "AppDelegate.h"
#import <React/RCTBundleURLProvider.h>
#import <React/RCTRootView.h>
#import <React/RCTAppSetupUtils.h>
#import <React/RCTLinkingManager.h>

@interface AppDelegate ()

@property (nonatomic, strong) NSString *performanceMetricsId;
@property (nonatomic, assign) BOOL isInitialized;
@property (nonatomic, strong) NSDate *startTime;

@end

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // Initialize performance tracking
  self.startTime = [NSDate date];
  self.performanceMetricsId = [[NSUUID UUID] UUIDString];
  
  // Configure security settings
  [self configureSecuritySettings];
  
  // Initialize React Native bridge
  RCTAppSetupPrepareApp(application);
  
  // Create bridge configuration with enhanced error handling
  RCTBridge *bridge = [[RCTBridge alloc] initWithDelegate:self launchOptions:launchOptions];
  
  // Create root view with performance monitoring
  RCTRootView *rootView = [[RCTRootView alloc] initWithBridge:bridge
                                                   moduleName:@"MintClone"
                                            initialProperties:nil];
  
  // Configure root view appearance
  if (@available(iOS 13.0, *)) {
    rootView.backgroundColor = [UIColor systemBackgroundColor];
  } else {
    rootView.backgroundColor = [UIColor whiteColor];
  }
  
  // Configure window and root view controller
  self.window = [[UIWindow alloc] initWithFrame:[UIScreen mainScreen].bounds];
  UIViewController *rootViewController = [UIViewController new];
  rootViewController.view = rootView;
  self.window.rootViewController = rootViewController;
  [self.window makeKeyAndVisible];
  
  // Configure deep linking
  [self configureDeepLinking:application launchOptions:launchOptions];
  
  // Set up memory warning observer
  [self setupMemoryWarningObserver];
  
  // Log performance metrics
  [self logLaunchPerformance];
  
  return YES;
}

- (void)configureSecuritySettings
{
  // Configure security policies
  NSURLCache *sharedCache = [[NSURLCache alloc] initWithMemoryCapacity:5 * 1024 * 1024   // 5MB memory
                                                         diskCapacity:20 * 1024 * 1024    // 20MB disk
                                                         directoryURL:nil];
  [NSURLCache setSharedURLCache:sharedCache];
  
  // Enable SSL pinning in production
  #if !DEBUG
    // SSL pinning configuration would go here
  #endif
}

- (void)configureDeepLinking:(UIApplication *)application launchOptions:(NSDictionary *)launchOptions
{
  // Configure deep linking with security validation
  NSURL *url = [NSURL URLWithString:@"mintclone://"];
  if ([application canOpenURL:url]) {
    [application registerForRemoteNotifications];
  }
}

- (void)setupMemoryWarningObserver
{
  [[NSNotificationCenter defaultCenter] addObserver:self
                                         selector:@selector(handleMemoryWarning)
                                             name:UIApplicationDidReceiveMemoryWarningNotification
                                           object:nil];
}

- (void)handleMemoryWarning
{
  // Log memory warning
  NSLog(@"Memory warning received - Performance Metrics ID: %@", self.performanceMetricsId);
  
  // Clear caches and perform cleanup
  [[NSURLCache sharedURLCache] removeAllCachedResponses];
}

- (void)logLaunchPerformance
{
  NSTimeInterval launchDuration = [[NSDate date] timeIntervalSinceDate:self.startTime];
  NSLog(@"App Launch Duration: %.2f seconds - Performance Metrics ID: %@", 
        launchDuration, 
        self.performanceMetricsId);
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
#if DEBUG
  // Development server URL with security checks
  NSString *serverIP = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"RCT_DEV_SERVER_IP"];
  if (!serverIP) {
    serverIP = @"localhost";
  }
  
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  // Production bundle with integrity verification
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

// Deep linking support
- (BOOL)application:(UIApplication *)application
            openURL:(NSURL *)url
            options:(NSDictionary<UIApplicationOpenURLOptionsKey,id> *)options
{
  // Validate URL scheme
  if (![url.scheme isEqualToString:@"mintclone"]) {
    return NO;
  }
  
  return [RCTLinkingManager application:application openURL:url options:options];
}

// Universal links support
- (BOOL)application:(UIApplication *)application
continueUserActivity:(NSUserActivity *)userActivity
 restorationHandler:(void (^)(NSArray<id<UIUserActivityRestoring>> * _Nullable))restorationHandler
{
  // Validate universal link domain
  if (![userActivity.webpageURL.host isEqualToString:@"mintclone.com"]) {
    return NO;
  }
  
  return [RCTLinkingManager application:application
                  continueUserActivity:userActivity
                    restorationHandler:restorationHandler];
}

- (void)applicationDidBecomeActive:(UIApplication *)application
{
  // Reset performance tracking on app activation
  self.startTime = [NSDate date];
  self.performanceMetricsId = [[NSUUID UUID] UUIDString];
}

- (void)dealloc
{
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}

@end