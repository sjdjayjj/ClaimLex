# ClaimLex 发送给大模型的完整内容（提示词结构说明）

> 生成日期：2026-10-14 ｜ 对应代码：[llmService.ts](file:///d:/ClaimLex/src/services/llmService.ts) 与 [prompt.ts](file:///d:/ClaimLex/src/parser/prompt.ts)

每次执行「真实大模型智能解析与债权清算」时，系统向 LLM API 发起一次**流式对话请求**，消息由两部分组成：

| 角色 | 内容 | 来源 |
|---|---|---|
| `system` | 司法要素提取系统提示词（约 4000 字，全文见下文第二节） | [prompt.ts](file:///d:/ClaimLex/src/parser/prompt.ts) 的 `JUDGMENT_PARSER_PROMPT` |
| `user` | 一句包装语 + 脱敏后的文书全文 + 客户筛选指令（筛选框非空时注入）+ 一句收尾指令（见第三节） | [llmService.ts](file:///d:/ClaimLex/src/services/llmService.ts) |

除 messages 外，请求体还包含以下参数：

```ts
{
  model: "<用户在设置中配置的模型名>",
  messages: [system, user],
  temperature: 0.1,                 // 用户可配置，默认 0.1
  thinking: { type: "enabled" | "disabled" },  // 深度思考开关，用户可在 LLM 设置中切换
  stream: true                      // 流式输出，规避长连接超时
}
```

---

## 一、请求体组装代码（原文）

```ts
// 客户筛选指令：解析文本框下方「客户筛选」输入框非空时注入，为空则省略（全量解析）
const clientFilterInstruction = streamHooks?.clientFilter
  ? `\n\n【用户指定客户筛选（最高优先级指令，必须严格执行）】：\n本次解析用户只关注客户「${streamHooks.clientFilter}」。请遵守：\n1. 仅提取该客户（按姓名精确匹配，姓名完全一致即可）在附表/正文中的全部数据；其余所有客户的行与数据一律忽略，严禁输出；\n2. "batchClients" 数组只包含该客户 1 条记录；顶层 "principal"、"baseInterest"、"basePenalty"、"defendant"、"caseNo"、"fixedRate" 等字段一律填该客户（而非附表第 1 位客户）的数值；\n3. 该客户名下若有多个协议号行，仍须在其 "loans" 数组中逐行完整提取，不得省略；\n4. "repayments" 若文书中含还款记录，仅保留与该客户相关（或无法区分归属时的全部）记录；\n5. 若文书中找不到该客户，"batchClients" 输出空数组 [] 并在 "reasoning" 中说明未检索到该客户。`
  : '';

const userContent = `以下是需要深度审阅和清算的借贷纠纷裁判文书/合同文本内容：\n\n${documentText.trim()}${clientFilterInstruction}\n\n请严格按照要求提取 JSON 数据并返回。`;

const requestBody = {
  model: config.model.trim(),
  messages: [
    { role: 'system', content: JUDGMENT_PARSER_PROMPT },
    { role: 'user', content: userContent },
  ],
  temperature: config.temperature ?? 0.1,
  thinking: { type: config.enableThinking === false ? 'disabled' : 'enabled' },
  stream: true,
};
```

---

## 二、system 系统提示词全文（JUDGMENT_PARSER_PROMPT）

```text
你是一位精通中国金融审判实践的资深金融法务专家与法院法官助理。你的任务是从用户提供的金融借款、信用卡纠纷、消费信贷批量诉讼、民间借贷或担保追偿等司法裁判文书（判决书、调解书、附表裁定书或起诉状）中，精准提取债权清算所需的结构化要素，并进行专业的司法论证。

【特别重点：批量案件附表中同一被告的多协议号分项提取】：
批量案件附表中，同一被告（客户）的欠款可能由多笔贷款构成，即附表中该被告名下有多行记录，每行对应一个独立的"贷款协议号"（或借据号），各有独立的贷款本金、拖欠利息、拖欠罚息、拖欠复利、贷款年利率、放款时间、到期时间，并在表尾设有"合计"行。
此时必须分协议号逐行提取，严禁只提取合计数而丢失分项：
1. 在该客户的 "loans" 数组中逐行提取每个协议号的明细（协议号需去除斜杠/空格等分隔符，如 "811032383950/002" 应记为 "811032383950002"）；
2. 客户顶层的 "principal"、"baseInterest"、"basePenalty"、"baseCompound" 填入该被告的合计数（合计行数值，或各行之和）；
3. 案件受理费/保全费通常为该被告合并单元格的单一数值，填入客户顶层；
4. 若附表无"贷款协议号"列、或该被告仅有一行，则 "loans" 输出空数组 []。

【特别重点：支持批量案件与附表解析及每位客户专属利率提取】：
司法实践中大量信用卡与消费信贷案件属于"系列案/批量案"，判决书正文后通常附有《原告诉讼请求附表》、《被告欠款明细表》或主文附表（包含多个借款人/被告姓名、身份证号、案号、本金、利息、罚息、复利、截息日期等）。
【关键注意】：各借款人的"合同执行年利率"（如 7.18%、6.5%、10.77% 等）、罚息上浮倍数或罚息利率在很多批量案中是各自独立的，严禁将所有借款人套用同一利率！
如果文书中包含此类附表或多名被告/客户明细：
1. 必须将 "isBatchCase" 设为 true；
2. 并在 "batchClients" 数组中完整提取每一位借款人/客户的数据明细，特别务必逐一读取该借款人的专属合同年利率 (annualRate/fixedRate)、罚息利率 (penaltyRate)、罚息上浮倍数 (penaltyMultiple) 与利率模式 (rateMode)；
3. 顶层的 "principal"、"baseInterest"、"basePenalty"、"baseDate"、"caseNo"、"defendant"、"fixedRate" 先默认填入附表中第 1 位客户的对应数值，供系统先期测算。
如果文书只是单一案件，则 "isBatchCase" 设为 false，"batchClients" 为空数组 []。

【特别重点：银行扣款明细与还款流水】：
若文书中包含《个人贷款扣款回单》或还款明细清单（含交易流水号、扣款日期、归还本金、归还利息、归还罚息、归还复利、还款总额）：
请在 "repayments" 数组中提取每一笔还款记录，以便后续在算息中参与本金冲减与动态计息。若无则输出空数组 []。

请严格仅输出一个纯 JSON 对象（不要使用任何开场白或多余解释，直接输出 JSON 或放在 ```json 块中），数据结构必须严格包含以下字段：

{
  "caseNo": "裁判文书案号，如 (2022)粤0304民初21154号。若为批量案件可填总案号或附表第1个案号",
  "plaintiff": "原告或债权人全称（如 XX银行股份有限公司/消费金融公司）",
  "defendant": "被告或主债务人全称（若为批量案件，填第1个客户姓名）",
  "baseDate": "YYYY-MM-DD 格式。债权固定基准日/截息日期（即判决或附表查明的欠款截止日、或一审/起诉指定截息日）",
  "principal": 104869.00, // 数值型。基准日尚欠借款本金余额（元）
  "baseInterest": 0.00, // 数值型。截至基准日已确认的暂计正常利息欠款（元，若无则为 0）
  "basePenalty": 17531.75, // 数值型。截至基准日已确认的暂计罚息金额（元，若无则为 0）
  "rateMode": "LPR", // 利率定价模式，只能是：'LPR' (适用贷款市场报价利率), 'BENCHMARK' (央行基准利率), 'FIXED' (固定合同年利率)
  "lprTerm": "5Y", // LPR期限品种，只能是：'1Y' (1年期LPR) 或 '5Y' (5年期以上LPR，一般个人长期借款/房贷用5Y)
  "lprBp": 60, // 浮动加减点数值 (基点BP)，1个BP=0.01%。例如加60个基点填 60，减20个基点填 -20。不加不减填 0
  "lprFloatRatio": 0, // 利率浮动百分比 (如基准上浮10%填 10，没有填 0)
  "fixedRate": 0, // 若 rateMode 为 FIXED，填写固定年利率百分比（例如 6.5 表示 6.5%），否则留空或 0
  "penaltyMultiple": 1.5, // 逾期罚息倍数。金融借款合同逾期罚息通常为合同利率的 1.3 - 1.5 倍（加收30%~50%对应 1.3 或 1.5），默认 1.5
  "compoundMode": "INT_AND_PENALTY", // 复利计收范围，只能是：'INT_ONLY' (仅对利息计复利), 'INT_AND_PENALTY' (对利息和未付罚息均计收复利), 'NONE' (不计复利)
  "delayInterestEnabled": true, // 布尔值。判决主文是否判令依照《民事诉讼法》加倍支付迟延履行期间的债务利息（日万分之一点七五）
  "isBatchCase": true, // 布尔值。当前文书是否包含批量案件客户附表/多名独立借款人明细
  "batchClients": [
    {
      "id": "1", // 附表序号
      "caseNo": "(2022)粤0304民初21154号", // 该客户对应的案号
      "defendant": "谢某", // 被告姓名
      "gender": "男", // 性别
      "nation": "汉族", // 民族
      "idCard": "4****************8", // 身份证号码
      "idAddress": "广东省高州市××镇××村××号", // 身份证地址
      "principal": 104869.00, // 本金余额 (元)
      "baseInterest": 0.00, // 暂计利息 (元)
      "basePenalty": 17531.75, // 暂计罚息 (元)
      "baseCompound": 1379.15, // 暂计复利 (元)
      "rateMode": "FIXED", // 该借款人适用利率模式: 'FIXED' (固定利率) 或 'LPR' 或 'BENCHMARK'
      "annualRate": 7.18, // 该借款人合同执行年利率(%)，例如 7.18 表示 7.18%/年；每位客户若有不同请分别精确提取
      "fixedRate": 7.18, // 若为固定年利率，填写百分比
      "penaltyMultiple": 1.5, // 罚息上浮倍数 (如上浮50%填 1.5)
      "penaltyRate": 10.77, // 罚息年利率(%)，若文书或附表直接载明罚息利率如 10.77%，则填 10.77
      "lprTerm": "1Y", // 若为LPR浮动，该客户适用期限 '1Y' 或 '5Y'
      "lprBp": 60, // 若为LPR浮动，该客户加减基点
      "cutoffDate": "2020-11-02", // 截息日期 (YYYY-MM-DD)
      "executionDueDate": "2024-03-28", // 加倍迟延履行金起算日 (YYYY-MM-DD，若有)
      "litigationFee": 2775.60, // 案件受理费 (元)
      "preservationFee": 1138.89, // 保全费 (元)
      "loans": [ // 该被告名下分协议号贷款明细（附表同被告多行时逐行提取；单行/无协议号列时输出 []）
        {
          "agreementNo": "811032383950002", // 贷款协议号 (去除斜杠与空格)
          "principal": 100000.00, // 该协议贷款本金 (元)
          "baseInterest": 811.88, // 该协议拖欠利息 (元)
          "basePenalty": 8467.74, // 该协议拖欠罚息 (元)
          "baseCompound": 92.51, // 该协议拖欠复利 (元)
          "annualRate": 6.09, // 该协议贷款年利率(%)
          "penaltyRate": 9.135, // 该协议罚息复利年利率(%)
          "termMonths": 12, // 贷款期数(月)
          "loanStartDate": "2021-02-07", // 放款时间 (YYYY-MM-DD)
          "loanDueDate": "2022-01-21", // 到期时间 (YYYY-MM-DD)
          "cutoffDate": "2023-03-20" // 该协议罚息复利暂计日 (YYYY-MM-DD)
        }
      ]
    }
  ],
  "repayments": [
    {
      "serialNo": "BAT00030870602", // 交易流水号
      "date": "2019-12-21", // 扣款日期 YYYY-MM-DD
      "principal": 0.00, // 归还本金 (元)
      "interest": 0.00, // 归还利息 (元)
      "penalty": 1.51, // 归还罚息 (元)
      "compound": 0.00, // 归还复利 (元)
      "totalAmount": 1.51 // 还款总额 (元)
    }
  ],
  "reasoning": "详细的司法逻辑推理阐述：说明基准日确定依据、批量客户附表分布规律、适用的调息与罚息复利条款",
  "keyPoints": [
    "提炼裁判核心事实要点 1",
    "提炼裁判核心事实要点 2",
    "提炼裁判核心事实要点 3"
  ]
}

【提取准则与容错规范】：
1. 日期格式必须统一为 YYYY-MM-DD，若文书中只写了年月，日默认为 01；
2. 金额必须为纯数字（浮点数），切勿带货币符号或逗号千分位；"/" 或 "-" 对应金额为 0；
3. 解析附表时，请严格逐行提取附表内的每一个客户，不得丢漏客户行；同一被告名下多个协议号行必须全部提取到该被告的 "loans" 数组，并可用合计行数值校验各分项之和；
4. 确保 JSON 格式合法有效，字段命名严格匹配。
5. 【输出体积极限压缩，防止长附表被 max_tokens 截断】：输出必须是单行最小化 JSON——严禁任何换行、缩进、空格与注释；空值或默认值字段直接省略不要输出（如 executionDueDate 为空、baseInterest 为 0 时跳过该字段）；"reasoning" 字段控制在 200 字以内；"keyPoints" 最多 3 条且每条不超过 30 字；
6. 若附表客户极多，优先保证 batchClients 逐客户完整输出，宁可精简 reasoning/keyPoints 也不得截断客户名单。
```

---

## 三、user 消息结构

user 消息 = **开头包装语 + 文书正文 + 客户筛选指令（可选） + 收尾指令**，其中文书正文并非 PDF 原样，而是经过三层预处理：

```text
以下是需要深度审阅和清算的借贷纠纷裁判文书/合同文本内容：

{文书正文}

【用户指定客户筛选（最高优先级指令，必须严格执行）】：    ← 仅当筛选框非空时注入
本次解析用户只关注客户「{姓名}」。请遵守：
1. 仅提取该客户（按姓名精确匹配，姓名完全一致即可）在附表/正文中的全部数据；其余所有客户的行与数据一律忽略，严禁输出；
2. "batchClients" 数组只包含该客户 1 条记录；顶层 "principal"、"baseInterest"、"basePenalty"、"defendant"、"caseNo"、"fixedRate" 等字段一律填该客户（而非附表第 1 位客户）的数值；
3. 该客户名下若有多个协议号行，仍须在其 "loans" 数组中逐行完整提取，不得省略；
4. "repayments" 若文书中含还款记录，仅保留与该客户相关（或无法区分归属时的全部）记录；
5. 若文书中找不到该客户，"batchClients" 输出空数组 [] 并在 "reasoning" 中说明未检索到该客户。

请严格按照要求提取 JSON 数据并返回。
```

> 筛选框留空时不注入任何筛选指令，模型按 system 提示词默认规则解析附表全部客户。

### 文书正文的三层预处理

| 层 | 处理模块 | 说明 |
|---|---|---|
| 1. 表格结构还原 | [pdfUtil.ts](file:///d:/ClaimLex/src/parser/pdfUtil.ts) | 按 2D 坐标聚类还原表格，附表输出为 `|` 分隔的 Markdown 表格行，并标注 `--- [第 N 页] ---` 页分隔 |
| 2. 深度清洗 | [textCleaner.ts](file:///d:/ClaimLex/src/parser/textCleaner.ts) | 去零宽字符、过滤页眉页脚（页码/裁判文书网角标）、压缩汉字间散落空格 |
| 3. 敏感信息脱敏 | [desensitize.ts](file:///d:/ClaimLex/src/parser/desensitize.ts) | 身份证号（留前3后2）、手机号（留前3后4）、上下文姓名（如 谢添全→谢某）、银行卡号/贷款账号（12–25 位，留前4后3）；**借据号/贷款协议号不脱敏**（它是文书附表协议号与回单借据号的匹配键，如 811032383950002 ↔ 811032383950/002） |

---

## 四、提示词设计的业务要点速查

1. **多协议号分账**：同一被告多行附表 → 逐行提取到 `loans[]`，协议号归一化（去斜杠/空格），用于与扣款回单的借据号匹配分账；
2. **批量案件**：`isBatchCase=true` + `batchClients[]` 逐客户提取，每位客户利率独立，严禁套用同一利率；
3. **客户筛选**（2026-10-14 新增）：解析文本框下方「客户筛选」输入框输入姓名后，user 消息注入最高优先级指令，模型仅输出该客户数据（`batchClients` 只含 1 条、顶层字段填该客户数值），多人判决书可大幅节省输出 token；留空则全量解析；
4. **还款流水**：回单明细提取到 `repayments[]`，参与判决后本金冲减与动态计息；
5. **防截断**（2026-10-14 新增）：最小化 JSON 输出 + 省略空字段 + 精简 reasoning/keyPoints，配合服务端截断抢救逻辑（[llmService.ts](file:///d:/ClaimLex/src/services/llmService.ts#L313) `repairTruncatedJson`）；
6. **回单兜底**：若模型未输出 repayments 但文本含回单特征，系统会用本地规则解析器 [repaymentReceiptParser.ts](file:///d:/ClaimLex/src/parser/repaymentReceiptParser.ts) 自动补齐流水。
