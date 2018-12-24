# Timing Report: Python Language Server Startup

Downloads occurred on a wireless network, ranging between 5-6 Mbps.

## Summary:
Download & load takes approximately 1 minute across the board on a decent wifi/Internet connection, and is by far the biggest factor in slow perceived load up time. The next biggest chunk of time is the call to `getInterpreterData` which takes approximately 80% of the perceived Python Language Server load up time.

My hypothesis for the ~5 minute load up times we are hearing about is that these users are downloading the Python Language Server for the first time, and have a slower download link than what I used in my testing.


I've tested this on a few different Python repositories found on Github:

## Repo: PTVSD

### LS Downloaded : 0.87 sec

| Label | Timestamp | Duration (ms) |
|-|-|-|
| startingPerfSession | 4511.8401 | 0 |
| getCurrentLanguageServerDirectory | 4549.1223 | 37.28219999999965 |
| shouldLookForNewLanguageServer | 4550.0317 | 0.9093999999995503 |
| getLanguageServerFolderName | 4550.2949 | 0.2632000000003245 |
| getInterpreterData | 5233.485599 | 683.1906989999998 |
| getEnvironmentVariables | 5233.7009 | 0.21530100000018138 |
| fixing-up-paths | 5234.0296 | 0.3287000000000262 |
| getAnalysisOptions | 5234.132499 | 0.10289900000043417 |
| discoverLSFileForDownloading | 5235.308 | 1.1755009999997128 |
| createSelfContainedLanguageClient | 5385.5794 | 150.27139999999963 |
| pushLanguageClientAndStart_Begin | 5385.647299 | 0.06789900000057969 |
| pushLanguageClientAndStart_Completed | 5386.049599 | 0.402299999999741 |

Largest Duration item was 'getInterpreterData' at 683.1906989999998ms, or 78.14953964484431% of the total.
Total duration of session: 874.209499 ms

### LS Not Downloaded: 65.7 sec

| Label | Timestamp | Duration (ms) |
|-|-|-|
| startingPerfSession | 4993.327499 | 0 |
| getCurrentLanguageServerDirectory | 5000.3706 | 7.043101000000206 |
| shouldLookForNewLanguageServer | 5001.513 | 1.142399999999725 |
| getLatestLanguageServerVersion | 7046.2949 | 2044.7819 |
| getLanguageServerFolderName | 7046.5587 | 0.26379999999971915 |
| getInterpreterData | 7464.4775 | 417.9188000000004 |
| getEnvironmentVariables | 7464.7008 | 0.22329999999965366 |
| fixing-up-paths | 7465.037999 | 0.33719900000050984 |
| getAnalysisOptions | 7465.1387 | 0.10070100000029925 |
| discoverLSFileForDownloading | 7466.007899 | 0.8691989999997531 |
| downloadLanguageServer | 70579.6712 | 63113.66330099999 |
| createSelfContainedLanguageClient | 70692.9272 | 113.2560000000085 |
| pushLanguageClientAndStart_Begin | 70693 | 0.07279999999445863 |
| pushLanguageClientAndStart_Completed |     | 0.42389900000125635 |

Largest Duration item was 'downloadLanguageServer' at 63113.66330099999ms, or 96.06327350990004% of the total.
Total duration of session: 65700.0964

## Repo: vislib

 ### LS Downloaded: 0.93 sec

| Label | Timestamp | Duration (ms) |
|-|-|-|
| startingPerfSession | 5346.52 | 0 |
| getCurrentLanguageServerDirectory | 5379.4514 | 32.931399999999485 |
| shouldLookForNewLanguageServer | 5380.5461 | 1.0946999999996478 |
| getLanguageServerFolderName | 5380.9455 | 0.39940000000024156 |
| getInterpreterData | 6136.5297 | 755.5842000000002 |
| getEnvironmentVariables | 6136.7969 | 0.2672000000002299 |
| fixing-up-paths | 6137.1461 | 0.3491999999996551 |
| getAnalysisOptions | 6137.254 | 0.10789999999997235 |
| discoverLSFileForDownloading | 6139.1375 | 1.8834999999999127 |
| createSelfContainedLanguageClient | 6276.374199 | 137.23669900000004 |
| pushLanguageClientAndStart_Begin | 6276.4464 | 0.07220099999995 |
| pushLanguageClientAndStart_Completed | 6276.8335 | 0.3870999999999185 |

Largest Duration item was 'getInterpreterData' at 755.5842000000002ms, or 81.21823449837073% of the total.
Total duration of session: 930.3135

### LS Not Downloaded: 70.3 sec

| Label | Timestamp | Duration (ms) |
|-|-|-|
| startingPerfSession | 4967.2329 | 0 |
| getCurrentLanguageServerDirectory | 5007.3818 | 40.14890000000014 |
| shouldLookForNewLanguageServer | 5008.6745 | 1.292699999999968 |
| getLatestLanguageServerVersion | 7663.0411 | 2654.3666000000003 |
| getLanguageServerFolderName | 7663.352499 | 0.31139899999925547 |
| getInterpreterData | 8402.1422 | 738.7897010000006 |
| getEnvironmentVariables | 8402.4418 | 0.2996000000002823 |
| fixing-up-paths | 8402.8548 | 0.41299999999864667 |
| getAnalysisOptions | 8402.980099 | 0.12529900000117777 |
| discoverLSFileForDownloading | 8404.1436 | 1.163500999999087 |
| downloadLanguageServer | 75193.1934 | 66789.04980000001 |
| createSelfContainedLanguageClient | 75302.5983 | 109.40489999999409 |
| pushLanguageClientAndStart_Begin | 75302.6669 | 0.06859999999869615 |
| pushLanguageClientAndStart_Completed | 75303.0698 | 0.4029000000009546 |

Largest Duration item was 'downloadLanguageServer' at 66789.04980000001ms, or 94.95735423601679% of the total.
Total duration of session: 70335.8369ms

## Repo: Flask

### LS Downloaded: 0.98 sec

| Label | Timestamp | Duration (ms) |
|-|-|-|
| startingPerfSession | 4717.1243 | 0 |
| getCurrentLanguageServerDirectory | 4727.5049 | 10.380599999999504 |
| shouldLookForNewLanguageServer | 4728.597599 | 1.0926989999998113 |
| getLanguageServerFolderName | 4728.8805 | 0.2829010000004928 |
| getInterpreterData | 5605.1853 | 876.3047999999999 |
| getEnvironmentVariables | 5605.4624 | 0.2771000000002459 |
| fixing-up-paths | 5605.8351 | 0.3726999999998952 |
| getAnalysisOptions | 5605.950599 | 0.11549899999954505 |
| discoverLSFileForDownloading | 5607.1419 | 1.1913009999998394 |
| createSelfContainedLanguageClient | 5699.3761 | 92.23420000000078 |
| pushLanguageClientAndStart_Begin | 5699.4458 | 0.06970000000001164 |
| pushLanguageClientAndStart_Completed | 5700.0327 | 0.5868999999993321 |

Largest Duration item was 'getInterpreterData' at 876.3047999999999ms, or 89.15426910584953% of the total.
Total duration of session: 982.9084ms

### LS Not Downloaded: 68.4 sec

| Label | Timestamp | Duration (ms) |
|-|-|-|
| startingPerfSession | 5170.7323 | 0 |
| getCurrentLanguageServerDirectory | 5185.7506 | 15.018300000000636 |
| shouldLookForNewLanguageServer | 5187.152 | 1.4013999999997395 |
| getLatestLanguageServerVersion | 7343.9714 | 2156.8194000000003 |
| getLanguageServerFolderName | 7344.2215 | 0.2500999999992928 |
| getInterpreterData | 7805.5214 | 461.2999 |
| getEnvironmentVariables | 7805.7858 | 0.2644000000000233 |
| fixing-up-paths | 7806.143599 | 0.35779900000034104 |
| getAnalysisOptions | 7806.256099 | 0.1125000000001819 |
| discoverLSFileForDownloading | 7807.887699 | 1.6315999999997075 |
| downloadLanguageServer | 73485.4181 | 65677.530401 |
| createSelfContainedLanguageClient | 73588.9464 | 103.5283000000054 |
| pushLanguageClientAndStart_Begin | 73589.006299 | 0.05989899999985937 |
| pushLanguageClientAndStart_Completed | 73589.712699 | 0.7063999999954831 |

Largest Duration item was 'downloadLanguageServer' at 65677.530401ms, or 95.9931440339908% of the total.
Total duration of session: 68418.980399ms

## Repo: Django

### LS Downloaded: 1.3 sec

| Label | Timestamp | Duration (ms) |
|-|-|-|
| startingPerfSession | 4750.225799 | 0 |
| getCurrentLanguageServerDirectory | 4769.994499 | 19.768700000000536 |
| shouldLookForNewLanguageServer | 4771.3064 | 1.3119010000000344 |
| getLanguageServerFolderName | 4771.6246 | 0.31819999999970605 |
| getInterpreterData | 6012.9052 | 1241.2806 |
| getEnvironmentVariables | 6013.1651 | 0.259900000000016 |
| fixing-up-paths | 6013.5319 | 0.36679999999978463 |
| getAnalysisOptions | 6013.6702 | 0.13829999999961728 |
| discoverLSFileForDownloading | 6014.868499 | 1.1982990000005884 |
| createSelfContainedLanguageClient | 6145.843299 | 130.97479999999996 |
| pushLanguageClientAndStart_Begin | 6145.9753 | 0.13200099999994563 |
| pushLanguageClientAndStart_Completed | 6147.1685 | 1.193199999999706 |

Largest Duration item was 'getInterpreterData' at 1241.2806ms, or 88.85694446246296% of the total.
Total duration of session: 1396.942701ms

### LS Not Downloaded: 69.7 sec

| Label | Timestamp | Duration (ms) |
|-|-|-|
| startingPerfSession | 4907.4594 | 0 |
| getCurrentLanguageServerDirectory | 4936.2162 | 28.756800000000112 |
| shouldLookForNewLanguageServer | 4937.5108 | 1.2946000000001732 |
| getLatestLanguageServerVersion | 7309.9553 | 2372.4444999999996 |
| getLanguageServerFolderName | 7310.185 | 0.22970000000077562 |
| getInterpreterData | 7683.869999 | 373.68499899999915 |
| getEnvironmentVariables | 7684.1239 | 0.2539010000000417 |
| fixing-up-paths | 7684.488499 | 0.3645990000004531 |
| getAnalysisOptions | 7684.6059 | 0.11740099999951781 |
| discoverLSFileForDownloading | 7685.5861 | 0.9802000000008775 |
| downloadLanguageServer | 74483.1208 | 66797.5347 |
| createSelfContainedLanguageClient | 74608.2118 | 125.09100000000035 |
| pushLanguageClientAndStart_Begin | 74608.319699 | 0.10789899999508634 |
| pushLanguageClientAndStart_Completed | 74608.742 | 0.4223009999986971 |

Largest Duration item was 'downloadLanguageServer' at 66797.5347ms, or 95.83401080771504% of the total.
Total duration of session: 69701.2826ms
