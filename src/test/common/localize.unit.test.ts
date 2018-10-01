import * as assert from 'assert';
import * as TypeMoq from 'typemoq';
import { ConfigurationChangeEvent, Disposable } from 'vscode';

import { IWorkspaceService } from '../../client/common/application/types';
import * as localize from '../../utils/localize';
import { UnitTestIocContainer } from '../unittests/serviceRegistry';

// Defines a Mocha test suite to group tests of similar kind together
suite('localize tests', () => {
    let ioc: UnitTestIocContainer;
    let workspace: TypeMoq.IMock<IWorkspaceService>;
    let callbackHandler!: (e: ConfigurationChangeEvent) => Promise<void>;

    setup(initializeDI);
    teardown(() => {
        ioc.dispose();
    });

    function initializeDI() {
        ioc = new UnitTestIocContainer();
        ioc.registerFileSystemTypes();
        ioc.registerProcessTypes();
        ioc.registerVariableTypes();
        ioc.registerMockProcess();

        workspace = TypeMoq.Mock.ofType<IWorkspaceService>();
        // Setup the configuration change handler to actually work so that the localizationservice is called when the workspace updates
        workspace.setup(w => w.onDidChangeConfiguration(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny()))
        .callback(cb => callbackHandler = cb)
        .returns(() => TypeMoq.Mock.ofType<Disposable>().object)
        .verifiable(TypeMoq.Times.once());
        ioc.serviceManager.addSingletonInstance<IWorkspaceService>(IWorkspaceService, workspace.object);
        ioc.serviceManager.addSingleton<localize.ILocalizationService>(localize.ILocalizationService, localize.LocalizationService);

        // Create the actual loc service who should listen to workspace config change events
        const locService = ioc.serviceContainer.get<localize.ILocalizationService>(localize.ILocalizationService);
        locService.initialize();
    }
    test('keys', done => {
        const val = localize.LanguageServiceSurveyBanner.bannerMessage;
        assert.equal(val, 'Can you please take 2 minutes to tell us how the Python Language Server is working for you?', 'Create Terminal string doesnt match');
        done();
    });
    test('keys italian', done => {
        // Force a config change
        process.env.VSCODE_NLS_CONFIG = '{ "locale": "it" }';

        const event = TypeMoq.Mock.ofType<ConfigurationChangeEvent>();
        event.setup(e => e.affectsConfiguration(TypeMoq.It.isValue('python.jediEnabled'), TypeMoq.It.isAny()))
            .returns(() => true)
            .verifiable(TypeMoq.Times.atLeastOnce());

        callbackHandler(event.object).ignoreErrors();
        const val = localize.LanguageServiceSurveyBanner.bannerLabelYes;
        assert.equal(val, 'Sì, prenderò il sondaggio ora', 'bannerLabelYes is not being translated');
        done();
    });
});
