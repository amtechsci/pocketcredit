# eNACH auto-debit run — manual amount check

**Run context (from logs)**  
- Task: `auto-enach-dpd-daily`  
- `presentationDate`: 2026-04-16  
- Summary: scanned **66**, attempted **66**, success **0**, pending **58**, failed **8**

Use this table to cross-check **amount** / **penalty** vs your loan records or Cashfree.

| # | loan_id | application_no | EMI | due_date | DPD | amount (₹) | penalty (₹) | status | payment_id / error |
|---|--------:|-----------------|----:|----------|----:|-----------:|--------------:|--------|--------------------|
| 1 | 228 | PC43699231315 | 1 | 2026-03-31 | 16 | 1622.63 | 279.04 | PENDING | charge_sub_loan_228_1771148825352_1776352951601 |
| 2 | 254 | PC32181402973 | 1 | 2026-04-05 | 11 | 1363.10 | 200.32 | PENDING | charge_sub_loan_254_1771332857849_1776352952377 |
| 3 | 406 | PC19329074577 | 1 | 2026-04-07 | 9 | 1647.75 | 219.15 | PENDING | charge_sub_loan_406_1771581954136_1776352952770 |
| 4 | 454 | PC34043935914 | 1 | 2026-04-10 | 6 | 1716.97 | 181.22 | PENDING | charge_sub_loan_454_1772447038627_1776352953168 |
| 5 | 456 | PC34888214471 | 1 | 2026-04-01 | 15 | 1559.23 | 260.52 | PENDING | charge_sub_loan_456_1771587719980_1776352953522 |
| 6 | 463 | PC39457309545 | 1 | 2026-03-31 | 16 | 1740.12 | 299.24 | PENDING | charge_sub_loan_463_1772427305878_1776352953867 |
| 7 | 480 | PC50308505634 | 1 | 2026-03-31 | 16 | 2149.02 | 369.56 | PENDING | charge_sub_loan_480_1771581438354_1776352954319 |
| 8 | 486 | PC55031768314 | 1 | 2026-04-01 | 15 | 1063.11 | 177.63 | PENDING | charge_sub_loan_486_1771583980474_1776352954768 |
| 9 | 640 | PC40013081617 | 1 | 2026-03-31 | 16 | 2292.29 | 394.20 | PENDING | charge_sub_loan_640_1771588465380_1776352955148 |
| 10 | 681 | PC83165486585 | 1 | 2026-04-07 | 9 | 811.19 | 107.89 | PENDING | charge_sub_loan_681_1772526248990_1776352955500 |
| 11 | 691 | PC87834356104 | 1 | 2026-04-06 | 10 | 1657.38 | 234.98 | PENDING | charge_sub_loan_691_1772427129730_1776352955864 |
| 12 | 694 | PC88781875191 | 1 | 2026-04-10 | 6 | 1546.42 | 163.22 | PENDING | charge_sub_loan_694_1771924689059_1776352956209 |
| 13 | 729 | PC17233588027 | 1 | 2026-04-05 | 11 | 2346.05 | 344.78 | PENDING | charge_sub_loan_729_1772281722231_1776352956650 |
| 14 | 760 | PC86146413552 | 1 | 2026-04-07 | 9 | 2109.12 | 280.51 | FAILED | Request failed with status code 400 |
| 15 | 923 | PC66052371064 | 1 | 2026-04-05 | 11 | 2010.91 | 295.53 | PENDING | charge_sub_loan_923_1772398473237_1776352957047 |
| 16 | 1095 | PC44271633045 | 1 | 2026-04-15 | 1 | 2230.17 | 124.25 | PENDING | charge_sub_loan_1095_1772341584468_1776352957366 |
| 17 | 1107 | PC48326124475 | 1 | 2026-04-05 | 11 | 2346.05 | 344.78 | FAILED | Request failed with status code 400 |
| 18 | 1188 | PC13427897581 | 1 | 2026-03-26 | 21 | 1864.97 | 364.69 | PENDING | charge_sub_loan_1188_1772263894541_1776352957766 |
| 19 | 1224 | PC55663507182 | 1 | 2026-04-14 | 2 | 2844.04 | 188.04 | FAILED | Request failed with status code 500 |
| 20 | 1560 | PC65476540285 | 1 | 2026-04-15 | 1 | 1389.62 | 77.42 | FAILED | Request failed with status code 400 |
| 21 | 1625 | PC39058199603 | 1 | 2026-04-08 | 8 | 1592.30 | 197.50 | PENDING | charge_sub_loan_1625_1772535169615_1776352958315 |
| 22 | 1657 | PC55284411389 | 1 | 2026-04-10 | 6 | 6105.17 | 644.37 | PENDING | charge_sub_loan_1657_1772806239768_1776352958605 |
| 23 | 1752 | PC52085378629 | 1 | 2026-04-05 | 11 | 1656.99 | 243.51 | PENDING | charge_sub_loan_1752_1772954373412_1776352958973 |
| 24 | 1875 | PC19811108292 | 1 | 2026-04-07 | 9 | 2891.20 | 384.52 | PENDING | charge_sub_loan_1875_1773138646889_1776352959335 |
| 25 | 2153 | PC05970082768 | 1 | 2026-04-05 | 11 | 994.20 | 146.11 | PENDING | charge_sub_loan_2153_1772955815128_1776352959639 |
| 26 | 2171 | PC06709832598 | 1 | 2026-04-09 | 7 | 1858.75 | 213.55 | PENDING | charge_sub_loan_2171_1773052984893_1776352959997 |
| 27 | 2240 | PC42646979590 | 1 | 2026-03-31 | 16 | 2869.65 | 493.48 | FAILED | Request failed with status code 400 |
| 28 | 2256 | PC70599845363 | 1 | 2026-04-12 | 4 | 2043.29 | 176.25 | PENDING | charge_sub_loan_2256_1772798657030_1776352960446 |
| 29 | 2259 | PC72095015828 | 1 | 2026-03-26 | 21 | 2804.53 | 548.42 | PENDING | charge_sub_loan_2259_1772946965449_1776352960742 |
| 30 | 2357 | PC58425331669 | 1 | 2026-04-01 | 15 | 4846.87 | 809.83 | PENDING | charge_sub_loan_2357_1772885902133_1776352961121 |
| 31 | 2451 | PC47298605135 | 1 | 2026-04-10 | 6 | 1519.59 | 160.39 | PENDING | charge_sub_loan_2451_1772978725945_1776352961514 |
| 32 | 2507 | PC26383545368 | 1 | 2026-04-09 | 7 | 1858.75 | 213.55 | PENDING | charge_sub_loan_2507_1773060286180_1776352961805 |
| 33 | 2519 | PC37566737861 | 1 | 2026-04-10 | 6 | 753.08 | 79.48 | PENDING | charge_sub_loan_2519_1773494383116_1776352962225 |
| 34 | 2528 | PC44083691449 | 1 | 2026-04-10 | 6 | 1810.09 | 191.05 | PENDING | charge_sub_loan_2528_1773489074774_1776352962582 |
| 35 | 2532 | PC45490867210 | 1 | 2026-04-01 | 15 | 1731.03 | 289.23 | PENDING | charge_sub_loan_2532_1773122313259_1776352962888 |
| 36 | 2563 | PC61732360325 | 1 | 2026-03-31 | 16 | 2795.79 | 480.78 | PENDING | charge_sub_loan_2563_1773210671841_1776352963232 |
| 37 | 2574 | PC75682953710 | 1 | 2026-04-07 | 9 | 1606.22 | 213.62 | PENDING | charge_sub_loan_2574_1773157579718_1776352963592 |
| 38 | 2618 | PC29301749513 | 1 | 2026-04-15 | 1 | 1904.61 | 106.11 | PENDING | charge_sub_loan_2618_1773230946151_1776352963955 |
| 39 | 2630 | PC37620443775 | 1 | 2026-04-01 | 15 | 3889.40 | 649.85 | PENDING | charge_sub_loan_2630_1773210694130_1776352964288 |
| 40 | 2653 | PC55145301158 | 1 | 2026-04-01 | 15 | 3366.13 | 562.42 | FAILED | Request failed with status code 400 |
| 41 | 2657 | PC58959323078 | 1 | 2026-04-04 | 12 | 4983.60 | 757.92 | PENDING | charge_sub_loan_2657_1773350017953_1776352964732 |
| 42 | 2735 | PC23757433285 | 1 | 2026-04-01 | 15 | 2589.33 | 432.63 | FAILED | Request failed with status code 400 |
| 43 | 2739 | PC25708780588 | 1 | 2026-04-07 | 9 | 2405.88 | 319.98 | PENDING | charge_sub_loan_2739_1773250853395_1776352965222 |
| 44 | 2864 | PC27791428613 | 1 | 2026-04-02 | 14 | 3443.38 | 558.32 | PENDING | charge_sub_loan_2864_1773483807271_1776352965528 |
| 45 | 2995 | PC08315892135 | 1 | 2026-04-10 | 6 | 2481.49 | 261.91 | PENDING | charge_sub_loan_2995_1773667828912_1776352965793 |
| 46 | 3170 | PC73182541931 | 1 | 2026-04-05 | 11 | 2453.84 | 360.62 | PENDING | charge_sub_loan_3170_1773833304792_1776352966071 |
| 47 | 3262 | PC85531526552 | 1 | 2026-04-10 | 6 | 2259.25 | 238.45 | PENDING | charge_sub_loan_3262_1773578746108_1776352966399 |
| 48 | 3339 | PC02435817995 | 1 | 2026-04-10 | 6 | 3383.85 | 357.15 | PENDING | charge_sub_loan_3339_1773654281238_1776352966725 |
| 49 | 3367 | PC14822738069 | 1 | 2026-04-10 | 6 | 3835.03 | 404.77 | PENDING | charge_sub_loan_3367_1773656103984_1776352967068 |
| 50 | 3490 | PC69556706463 | 1 | 2026-04-08 | 8 | 2343.93 | 290.73 | PENDING | charge_sub_loan_3490_1773659043688_1776352967376 |
| 51 | 3499 | PC71216548735 | 1 | 2026-04-07 | 9 | 1587.77 | 211.17 | PENDING | charge_sub_loan_3499_1773751681294_1776352967666 |
| 52 | 3559 | PC91766286589 | 1 | 2026-04-08 | 8 | 3633.10 | 450.64 | PENDING | charge_sub_loan_3559_1773663946886_1776352967975 |
| 53 | 3588 | PC04849758672 | 1 | 2026-04-10 | 6 | 2807.30 | 296.30 | FAILED | Request failed with status code 400 |
| 54 | 3711 | PC48835287046 | 1 | 2026-04-01 | 15 | 4371.25 | 730.36 | PENDING | charge_sub_loan_3711_1773742119962_1776352968365 |
| 55 | 3943 | PC16244459660 | 1 | 2026-04-09 | 7 | 1524.10 | 175.10 | PENDING | charge_sub_loan_3943_1773931349477_1776352968738 |
| 56 | 4001 | PC31313705865 | 1 | 2026-04-10 | 6 | 2245.84 | 237.04 | PENDING | charge_sub_loan_4001_1773905282323_1776352969091 |
| 57 | 4188 | PC87486806132 | 1 | 2026-04-07 | 9 | 2378.20 | 316.30 | PENDING | charge_sub_loan_4188_1773926185449_1776352969416 |
| 58 | 4326 | PC31710731682 | 1 | 2026-04-10 | 6 | 1679.35 | 177.25 | PENDING | charge_sub_loan_4326_1774095134866_1776352969784 |
| 59 | 4395 | PC57189800205 | 1 | 2026-04-10 | 6 | 2239.13 | 236.33 | PENDING | charge_sub_loan_4395_1774075730951_1776352970081 |
| 60 | 4423 | PC94932951178 | 1 | 2026-04-07 | 9 | 2371.28 | 315.38 | PENDING | charge_sub_loan_4423_1774076351343_1776352970404 |
| 61 | 4647 | PC20160855633 | 1 | 2026-04-10 | 6 | 1679.35 | 177.25 | PENDING | charge_sub_loan_4647_1774096902142_1776352970763 |
| 62 | 4661 | PC20484858230 | 1 | 2026-04-10 | 6 | 1114.53 | 117.63 | PENDING | charge_sub_loan_4661_1774095269467_1776352971083 |
| 63 | 4843 | PC22191862042 | 1 | 2026-04-15 | 1 | 1508.52 | 84.04 | PENDING | charge_sub_loan_4843_1774262449818_1776352971485 |
| 64 | 5504 | PC77779713869 | 1 | 2026-04-10 | 6 | 1671.80 | 176.45 | PENDING | charge_sub_loan_5504_1774078360422_1776352971781 |
| 65 | 5659 | PC58126696133 | 1 | 2026-04-10 | 6 | 3348.63 | 353.43 | PENDING | charge_sub_loan_5659_1774183584846_1776352972093 |
| 66 | 6122 | PC36354248982 | 1 | 2026-04-10 | 6 | 2229.07 | 235.27 | PENDING | charge_sub_loan_6122_1774337015197_1776352972401 |

**Total presented (base + penalty column is amount which includes penalty in our logic — amount field is full charge amount)**

---

## If you run the job again — will it call the same loans?

**Same calendar day (IST), same EMI**

- There is already a row in `enach_auto_debit_runs` for that loan + EMI + `presentation_date = 2026-04-16`.
- The job will **skip** with a reason like `already_pending_today` or `already_failed_today` (any non-SKIPPED row for today blocks another attempt the same day).

**Next day (or later) within 3 days**

- Any prior attempt that is **not** `SKIPPED` (so PENDING, FAILED, SUCCESS) counts toward the **3-day cooldown** from that `presentation_date`.
- So for **2026-04-17 … 2026-04-19** (relative to 2026-04-16), the same unpaid EMI will typically be skipped with `cooldown_3d` unless you change that logic.

**After 3 full days from the last attempt’s `presentation_date`**

- A **new** presentation row can be inserted for a new `presentation_date`, and Cashfree can be called again for that EMI if it is still unpaid.

**When status becomes SUCCESS**

- That EMI is marked paid in `emi_schedule`; future runs move to the next EMI (or none).

**PENDING charges**

- The job `auto-enach-pending-recheck` (every 20 minutes) polls Cashfree and flips PENDING → SUCCESS or FAILED and updates the loan when SUCCESS.
- Until those settle, the EMI stays unpaid; cooldown still applies from the first presentation date.

---

## Note on `"enabled": false` in the log JSON

That field reflects the env flag `ENACH_AUTO_DEBIT_ENABLED` in code (scheduled cron off). **Manual admin “Run live”** still executed the job because `forceRun` bypasses that flag. The counts you see are from a real run.

---

## Failed rows (8) — typical next steps

- Inspect Cashfree dashboard / API error body for `400` / `500` (often amount &gt; mandate max, invalid subscription, sandbox vs prod mismatch).
- Cross-check `plan_max_amount` (60% of salary) vs presented `amount` for those `loan_id`s.
