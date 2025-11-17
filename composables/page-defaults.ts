export const usePageTitle  = (newTitle: string) => {
    let basicTitle = 'Lyra Music | ';

    let title = `${basicTitle} ${newTitle}`;
    
    return title;
}