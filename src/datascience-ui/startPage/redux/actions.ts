import { StartPageMessages } from '../../../client/datascience/startPage/types';

// This function isn't made common and not exported, to ensure it isn't used elsewhere.
function createIncomingAction(type: StartPageMessages) {
    return { type, payload: { messageDirection: 'incoming', data: undefined } };
}

export const actionCreators = {
    releaseNotes: {
        date: '',
        notes: ['']
    },
    requestReleaseNotes: () => createIncomingAction(StartPageMessages.RequestReleaseNotes)
};
