//@ts-nocheck
import { ExecutionLogSlicer } from '../log-slicer';
import { Location, DataflowAnalyzer } from '..';
import { expect, assert } from 'chai';
import { TestCell } from './testcell';
import * as testNotebooks from "./notebooks";
import { startLogging } from '../logutil';

function loc(line0: number, col0: number, line1 = line0 + 1, col1 = 0): Location {
    return { first_line: line0, first_column: col0, last_line: line1, last_column: col1 };
}

function makeLog(lines: string[]) {
    const cells = lines.map((text, i) => new TestCell(text, i + 1));
    const logSlicer = new ExecutionLogSlicer(new DataflowAnalyzer());
    cells.forEach(cell => logSlicer.logExecution(cell));
    return logSlicer;
}

describe('log-slicer', () => {




    describe('sliceAllExecutions', () => {
        it('does the basics', () => {
            const lines = ['x=5', 'y=6', 'print(x+y)'];
            const logSlicer = makeLog(lines);
            const lastCell = logSlicer.cellExecutions[logSlicer.cellExecutions.length - 1].cell;
            const slices = logSlicer.sliceAllExecutions(lastCell.persistentId);
            expect(slices).to.exist;
            expect(slices.length).eq(1);
            const slice = slices[0];
            expect(slice).to.exist;
            expect(slice.cellSlices).to.exist;
            expect(slice.cellSlices.length).eq(3);
            slice.cellSlices.forEach((cs, i) => {
                expect(cs).to.exist;
                expect(cs.textSliceLines).eq(lines[i]);
                expect(cs.textSlice).eq(lines[i]);
            });
        });

        it('triple execution', () => {
            const lines = [
                ["0", "x = 0"],
                ["0", "x = 0"],
                ["0", "x = 0"]
            ];
            const cells = lines.map(([pid, text], i) => new TestCell(text, i + 1, undefined, pid));
            const logSlicer = new ExecutionLogSlicer(new DataflowAnalyzer());
            cells.forEach(cell => logSlicer.logExecution(cell));

            const lastRerun = logSlicer.cellExecutions[2].cell;

            let slice = logSlicer.sliceLatestExecution(lastRerun.persistentId);
            expect(slice).to.exist;
            expect(slice.cellSlices).to.exist;
            expect(slice.cellSlices.length).eq(1);
            slice.cellSlices.forEach((cs, i) => {
                expect(cs).to.exist;
                expect(cs.textSliceLines).eq(lines[i][1]);
                expect(cs.textSlice).eq(lines[i][1]);
            });
        });

        it("does jim's demo", () => {
            const lines = [
			/*[1]*/  "import pandas as pd",
			/*[2]*/  "Cars = {'Brand': ['Honda Civic','Toyota Corolla','Ford Focus','Audi A4'], 'Price': [22000,25000,27000,35000]}\n" +
                "df = pd.DataFrame(Cars,columns= ['Brand', 'Price'])",
			/*[3]*/  "def check(df, size=11):\n" +
                "    print(df)",
			/*[4]*/  "print(df)",
			/*[5]*/  "x = df['Brand'].values"
            ];
            const logSlicer = makeLog(lines);
            const lastCell = logSlicer.cellExecutions[logSlicer.cellExecutions.length - 1].cell;
            const slice = logSlicer.sliceLatestExecution(lastCell.persistentId);
            expect(slice).to.exist;
            expect(slice.cellSlices).to.exist;
            [1, 2, 5].forEach((c, i) => expect(slice.cellSlices[i].textSliceLines).eq(lines[c - 1]));
            const cellCounts = slice.cellSlices.map(cell => cell.cell.executionCount);
            [3, 4].forEach(c => expect(cellCounts).to.not.include(c));
        });


        // NOTE: For now, the definiton and call to check end up in the slices
        // This is because we don't know the type of the formal parameter 'df'
        // so we can't tell whether the call to df.corr() has a side effect on df or not.
        // So, conservatively we leave it in. One day, if the language service gives us types,
        // we could maybe eliminate this.
        const checkCall = [
            [
                "def check(df, size=11):",
                '    """',
                '    Function plots a graphical correlation matrix for each pair of columns in the dataframe.',
                '    ',
                '    Input:',
                '        df: pandas DataFrame',
                '        size: vertical and horizontal size of the plot',
                "        ",
                '    Displays:',
                "        matrix of correlation between columns. Blue-cyan-yellow-red-darkred => less to more correlated",
                "                                               0------------------------->1",
                "                                               Expect a darkred line running from top to bottom right",
                '    """',
                '    ',
                "    corr = df.corr() # data frame correlation function",
                "    fig, ax = plt.subplots(figsize=(size, size))",
                "    ax.matshow(corr) # color code the rectangles by correlation value",
                "    plt.xticks(range(len(corr.columns)), corr.columns) # draw x tick marks",
                "    plt.yticks(range(len(corr.columns)), corr.columns) # draw y tick marks",
                '    ',
                '',
            ],
            ["check(df)"],
        ];

        it("does pima to cell 6", () => {
            const code = testNotebooks.cellCode(testNotebooks.pimaNotebook);
            const logSlicer = makeLog(code);
            const slice = logSlicer.sliceLatestExecution(logSlicer.cellExecutions[5].cell.persistentId);
            expect(slice).to.exist;
            expect(slice.cellSlices).to.exist;
            const expected = [
                [
                    'import pandas as pd # pandas is a dataframe library',
                    'import matplotlib.pyplot as plt # matplotlib.pyplot plots data'
                ],
                ['df = pd.read_csv("./data/pima-data.csv") # load Pima data'],
                ...checkCall,
                ['del df[\'skin\']'],
            ].map(lines => lines.join('\n'));
            const sliceText = slice.cellSlices.map(c => c.textSliceLines);
            expect(sliceText.length).eq(expected.length);
            sliceText.forEach((line, i) =>
                expect(line).eq(expected[i]));
        });

        it("does pima to cell 15", () => {
            const code = testNotebooks.cellCode(testNotebooks.pimaNotebook);
            const logSlicer = makeLog(code);
            const slice = logSlicer.sliceLatestExecution(logSlicer.cellExecutions[14].cell.persistentId);
            expect(slice).to.exist;
            expect(slice.cellSlices).to.exist;
            const expected = [
                [
                    'import pandas as pd # pandas is a dataframe library',
                    'import matplotlib.pyplot as plt # matplotlib.pyplot plots data'
                ],
                ['df = pd.read_csv("./data/pima-data.csv") # load Pima data'],
                ...checkCall,
                ['del df[\'skin\']'],
                ['diabetes_map = {True:1, False:0}'],
                ['df[\'diabetes\'] = df[\'diabetes\'].map(diabetes_map)'],
                [
                    "from sklearn.cross_validation import train_test_split",
                    "feature_col_names = ['num_preg', 'glucose_conc', 'diastolic_bp', 'thickness', 'insulin', 'bmi', 'diab_pred', 'age']",
                    "predicted_class_names = ['diabetes']",
                    "x = df[feature_col_names].values # predictor feature columns (8 X m)",
                    "y = df[predicted_class_names].values # predicted class (1=true, 0=false) column (1 X m)",
                    "split_test_size = 0.30",
                    "x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=split_test_size, random_state=42)",
                ],
                [
                    'from sklearn.preprocessing import Imputer',
                    'fill_0 = Imputer(missing_values=0, strategy="mean", axis=0)',
                    'x_train = fill_0.fit_transform(x_train)',
                    'x_test = fill_0.fit_transform(x_test)',
                ],
                [
                    'from sklearn.naive_bayes import GaussianNB',
                    'nb_model = GaussianNB()',
                    'nb_model.fit(x_train, y_train.ravel())',
                ],
                ['from sklearn import metrics',],
                [
                    'nb_predict_test = nb_model.predict(x_test)',
                    'print("Accurary: {0:.4f}".format(metrics.accuracy_score(y_test, nb_predict_test)))',
                    'print("")',
                ],
            ].map(lines => lines.join('\n'));

            const sliceText = slice.cellSlices.map(c => c.textSliceLines);
            expect(sliceText.length).eq(expected.length);
            sliceText.forEach((line, i) =>
                expect(line).eq(expected[i]));
        });


        it("does pima to cell 26", () => {
            const code = testNotebooks.cellCode(testNotebooks.pimaNotebook);
            const logSlicer = makeLog(code);
            const slice = logSlicer.sliceLatestExecution(logSlicer.cellExecutions[26].cell.persistentId);
            expect(slice).to.exist;
            expect(slice.cellSlices).to.exist;
            const expected = [
                [
                    'import pandas as pd # pandas is a dataframe library',
                    'import matplotlib.pyplot as plt # matplotlib.pyplot plots data'
                ],
                ['df = pd.read_csv("./data/pima-data.csv") # load Pima data'],
                ...checkCall,
                ['del df[\'skin\']'],
                ['diabetes_map = {True:1, False:0}'],
                ['df[\'diabetes\'] = df[\'diabetes\'].map(diabetes_map)'],
                [
                    "from sklearn.cross_validation import train_test_split",
                    "feature_col_names = ['num_preg', 'glucose_conc', 'diastolic_bp', 'thickness', 'insulin', 'bmi', 'diab_pred', 'age']",
                    "predicted_class_names = ['diabetes']",
                    "x = df[feature_col_names].values # predictor feature columns (8 X m)",
                    "y = df[predicted_class_names].values # predicted class (1=true, 0=false) column (1 X m)",
                    "split_test_size = 0.30",
                    "x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=split_test_size, random_state=42)",
                ],
                [
                    'from sklearn.preprocessing import Imputer',
                    'fill_0 = Imputer(missing_values=0, strategy="mean", axis=0)',
                    'x_train = fill_0.fit_transform(x_train)',
                    'x_test = fill_0.fit_transform(x_test)',
                ],
                [
                    'from sklearn.linear_model import LogisticRegression',
                    'lf_model = LogisticRegression(C=0.7, class_weight="balanced", random_state=42)',
                    'lf_model.fit(x_train, y_train.ravel())',
                ],
                ['lf_predict_train = lf_model.predict(x_train)'],
                [
                    'lf_predict_test = lf_model.predict(x_test)',
                    'from sklearn import metrics'
                ],
                [
                    'C_start = 0.1',
                    'C_end = 5',
                    'C_inc = 0.1',
                    'C_values, recall_scores =[], []',
                    'C_val = C_start',
                    'best_recall_score = 0',
                    'while(C_val < C_end):',
                    '    C_values.append(C_val)',
                    '    lr_model_loop = LogisticRegression(C=C_val, class_weight="balanced", random_state=42)',
                    '    lr_model_loop.fit(x_train, y_train.ravel())',
                    '    lr_predict_loop_test=lr_model_loop.predict(x_test)',
                    '    recall_score=metrics.recall_score(y_test, lr_predict_loop_test)',
                    '    recall_scores.append(recall_score)',
                    '    if(recall_score > best_recall_score):',
                    '        best_recall_score = recall_score',
                    '    C_val = C_val + C_inc',
                    'best_score_C_val = C_values[recall_scores.index(best_recall_score)]',
                ],
                [
                    'from sklearn.linear_model import LogisticRegression',
                    'lr_model = LogisticRegression(C=best_score_C_val, class_weight="balanced", random_state=42)',
                    'lr_model.fit(x_train, y_train.ravel())'
                ],
                [
                    'lr_predict_test = lr_model.predict(x_test)',
                    'from sklearn import metrics',
                    'print("Accurary: {0:.4f}".format(metrics.accuracy_score(y_test, lr_predict_test)))',
                    'print("")'
                ]
            ].map(lines => lines.join('\n'));

            const sliceText = slice.cellSlices.map(c => c.textSliceLines);
            expect(sliceText.length).eq(expected.length);
            sliceText.forEach((line, i) =>
                expect(line).eq(expected[i]));
        });

        it("does titanic", () => {
            const code = testNotebooks.cellCode(testNotebooks.titanicNotebook);
            const logSlicer = makeLog(code);
            const slice = logSlicer.sliceLatestExecution(logSlicer.cellExecutions[33].cell.persistentId);
            const expected = [
                [
                    "import numpy as np",
                    "import pandas as pd",
                    "df = pd.read_csv('train.csv')",
                ],
                [
                    "df['Age'].fillna(0 , inplace=True)",
                    "df['Embarked'].fillna('S' , inplace = True)",
                ],
                ["df['Sex'] = df['Sex'].map({'female':0,'male':1}).astype(np.int)"],
                ["df['Embarked'] = df['Embarked'].map({'nan':0,'S':1,'C':2,'Q':3}).astype(np.int)"],
                ["del df['Name']"],
                ["del df['Ticket']"],
                [
                    "feature=['PassengerId','Pclass','Sex','Age','SibSp','Parch','Fare','Embarked']",
                    "x=df[feature]",
                ],
                [
                    "y=df['Survived']",
                    "y.head()" // FIXME: should not be necessary
                ],
                [
                    "from sklearn.cross_validation import train_test_split",
                    "x_train,x_test,y_train,y_test=train_test_split(x,y,test_size=0.25,random_state=6)",
                ],
                [
                    "from sklearn.linear_model import LogisticRegression",
                    "logreg=LogisticRegression()",
                    "logreg.fit(x_train,y_train)",
                    "y_pred=logreg.predict(x_test)",
                ],
                ["df_test=pd.read_csv('test.csv')"],
                ["df_test['Age'].fillna(0 , inplace=True)"],
                [
                    "del df_test['Ticket']",
                    "del df_test['Cabin']",
                    "del df_test['Name']",
                ],
                [
                    "df_test['Sex'] = df_test['Sex'].map({'female':0,'male':1}).astype(np.int)",
                    "df_test['Embarked'] = df_test['Embarked'].map({'nan':0,'S':1,'C':2,'Q':3}).astype(np.int)",
                ],
                ["df_test['Fare'].fillna(0 , inplace=True)"],
                [
                    "test_feat = ['PassengerId','Pclass','Sex','Age','SibSp','Parch','Fare','Embarked']",
                    "X_test = df_test[test_feat]",
                ],
                ["Y_test_pred=logreg.predict(X_test)"],
                [
                    "df_test['Survived']=Y_test_pred",
                    "df_result = df_test.drop(['Pclass','Sex','Age','SibSp','Parch','Fare','Embarked'], axis=1)",
                    "df_result['Survived'] = df_result['Survived']",
                    "df_result.to_csv('result.csv', index=False)",
                    "df_result.head(50)",
                ],
            ].map(lines => lines.join('\n'));

            const sliceText = slice.cellSlices.map(c => c.textSliceLines);
            assert.deepEqual(sliceText, expected);
        });

    });




    describe("getDependentCells", () => {

        it("handles simple in-order", () => {
            const lines = [
                "x = 3",
                "y = x+1"
            ];
            const logSlicer = makeLog(lines);
            const deps = logSlicer.getDependentCells(logSlicer.cellExecutions[0].cell.executionEventId);
            expect(deps).to.exist;
            expect(deps).to.have.length(1);
            expect(deps[0].text).to.equal(lines[1]);
        });

        it("handles variable redefinition", () => {
            const lines = [
                "x = 3",
                "y = x+1",
                "x = 4",
                "y = x*2",
            ];
            const logSlicer = makeLog(lines);
            const deps = logSlicer.getDependentCells(logSlicer.cellExecutions[0].cell.executionEventId);
            expect(deps).to.exist;
            expect(deps).to.have.length(1);
            expect(deps[0].text).to.equal(lines[1]);
            const deps2 = logSlicer.getDependentCells(logSlicer.cellExecutions[2].cell.executionEventId);
            expect(deps2).to.exist;
            expect(deps2).to.have.length(1);
            expect(deps2[0].text).to.equal(lines[3]);
        });

        it("handles no deps", () => {
            const lines = [
                "x = 3\nprint(x)",
                "y = 2\nprint(y)",
            ];
            const logSlicer = makeLog(lines);
            const deps = logSlicer.getDependentCells(logSlicer.cellExecutions[0].cell.executionEventId);
            expect(deps).to.exist;
            expect(deps).to.have.length(0);
        });

        it("works transitively", () => {
            const lines = [
                "x = 3",
                "y = x+1",
                "z = y-1"
            ];
            const logSlicer = makeLog(lines);
            const deps = logSlicer.getDependentCells(logSlicer.cellExecutions[0].cell.executionEventId);
            expect(deps).to.exist;
            expect(deps).to.have.length(2);
            const deplines = deps.map(d => d.text);
            expect(deplines).includes(lines[1]);
            expect(deplines).includes(lines[2]);
        });

        it("includes all defs within cells", () => {
            const lines = [
                "x = 3\nq = 2",
                "y = x+1",
                "z = q-1"
            ];
            const logSlicer = makeLog(lines);
            const deps = logSlicer.getDependentCells(logSlicer.cellExecutions[0].cell.executionEventId);
            expect(deps).to.exist;
            expect(deps).to.have.length(2);
            const deplines = deps.map(d => d.text);
            expect(deplines).includes(lines[1]);
            expect(deplines).includes(lines[2]);
        });

        it("handles cell re-execution", () => {
            const lines = [
                ["0", "x = 2\nprint(x)"],
                ["1", "y = x+1\nprint(y)"],
                ["2", "q = 2"],
                ["0", "x = 20\nprint(x)"]
            ];
            const cells = lines.map(([pid, text], i) => new TestCell(text, i + 1, undefined, pid));
            const logSlicer = new ExecutionLogSlicer(new DataflowAnalyzer());
            cells.forEach(cell => logSlicer.logExecution(cell));

            const rerunFirst = logSlicer.cellExecutions[3].cell.executionEventId;
            const deps = logSlicer.getDependentCells(rerunFirst);
            expect(deps).to.exist;
            expect(deps).to.have.length(1);
            expect(deps[0].text).equals(lines[1][1]);
        });

        it("handles cell re-execution no-op", () => {
            const lines = [
                ["0", "x = 2\nprint(x)"],
                ["1", "y = 3\nprint(y)"],
                ["2", "q = 2"],
                ["0", "x = 20\nprint(x)"],
            ];
            const cells = lines.map(([pid, text], i) => new TestCell(text, i + 1, undefined, pid));
            const logSlicer = new ExecutionLogSlicer(new DataflowAnalyzer());
            cells.forEach(cell => logSlicer.logExecution(cell));

            const deps = logSlicer.getDependentCells(logSlicer.cellExecutions[3].cell.executionEventId);
            expect(deps).to.exist;
            expect(deps).to.have.length(0);
        });

        it("return result in topo order", () => {
            const lines = [
                ["0", "x = 1"],
                ["0", "y = 2*x"],
                ["0", "z = x*y"],
                ["0", "x = 2"],
                ["1", "y = x*2"],
                ["2", "z = y*x"],
                ["0", "x = 3"],
            ];
            const cells = lines.map(([pid, text], i) => new TestCell(text, i + 1, undefined, pid));
            const logSlicer = new ExecutionLogSlicer(new DataflowAnalyzer());
            cells.forEach(cell => logSlicer.logExecution(cell));
            const lastEvent = logSlicer.cellExecutions[logSlicer.cellExecutions.length - 1].cell.executionEventId;
            const deps = logSlicer.getDependentCells(lastEvent);
            expect(deps).to.exist;
            expect(deps).to.have.length(2);
            expect(deps[0].text).equals('y = x*2');
            expect(deps[1].text).equals('z = y*x');
        });

        it("can be called multiple times", () => {
            const lines = [
                ["0", "x = 1"],
                ["1", "y = 2*x"],
                ["2", "z = x*y"],
            ];
            const cells = lines.map(([pid, text], i) => new TestCell(text, i + 1, undefined, pid));
            const logSlicer = new ExecutionLogSlicer(new DataflowAnalyzer());
            cells.forEach(cell => logSlicer.logExecution(cell));
            const deps = logSlicer.getDependentCells(logSlicer.cellExecutions[0].cell.executionEventId);
            expect(deps).to.exist;
            expect(deps).to.have.length(2);
            expect(deps[0].text).equals('y = 2*x');
            expect(deps[1].text).equals('z = x*y');

            const edits = [
                ["0", "x = 2"],
                ["1", "y = x*2"],
                ["2", "z = y*x"],
                ["0", "x = 3"],
            ];
            const cellEdits = edits.map(([pid, text], i) => new TestCell(text, i + 1, undefined, pid));
            cellEdits.forEach(cell => logSlicer.logExecution(cell));
            const lastEvent = logSlicer.cellExecutions[logSlicer.cellExecutions.length - 1].cell.executionEventId;
            const deps2 = logSlicer.getDependentCells(lastEvent);
            expect(deps2).to.exist;
            expect(deps2).to.have.length(2);
            expect(deps2[0].text).equals('y = x*2');
            expect(deps2[1].text).equals('z = y*x');
        });

        it("handles api calls", () => {
            const lines = [
                ["0", "from matplotlib.pyplot import scatter\nfrom sklearn.cluster import KMeans\nfrom sklearn import datasets"],
                ["1", "data = datasets.load_iris().data[:,2:4]\npetal_length, petal_width = data[:,1], data[:,0]"],
                ["2", "k=3"],
                ["3", "clusters = KMeans(n_clusters=k).fit(data).labels_"],
                ["4", "scatter(petal_length, petal_width, c=clusters)"],
                ["2", "k=4"],
            ];
            const cells = lines.map(([pid, text], i) => new TestCell(text, i + 1, undefined, pid));
            const logSlicer = new ExecutionLogSlicer(new DataflowAnalyzer());
            cells.forEach(cell => logSlicer.logExecution(cell));

            const lastEvent = logSlicer.cellExecutions[logSlicer.cellExecutions.length - 1].cell.executionEventId;
            const deps = logSlicer.getDependentCells(lastEvent);
            expect(deps).to.exist;
            expect(deps).to.have.length(2);
            const sliceText = deps.map(c => c.text);
            expect(sliceText).to.include(lines[3][1]);
            expect(sliceText).to.include(lines[4][1]);
        });

    });

});
